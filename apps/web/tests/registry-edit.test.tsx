import { render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/app/app.js";
import { AppProviders } from "../src/app/app-providers.js";
import { clearSessionToken, writeSessionToken } from "../src/shared/api/session-token.js";

const PARTNER_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID = "22222222-2222-4222-8222-222222222222";

type Recorded = { body: unknown; method: string; pathname: string };

function stubRegistryApi(options: { role?: string } = {}) {
  const role = options.role ?? "OWNER";
  const requests: Recorded[] = [];
  const partner = {
    active: true,
    id: PARTNER_ID,
    legalName: "PARCEIRO SINTETICO",
    roles: ["CUSTOMER"],
    taxId: "11222333000181",
    type: "ORGANIZATION",
  };
  const product = {
    active: true,
    baseUnit: { code: "KG", decimalScale: 4, id: "unit-id", name: "Quilograma" },
    id: PRODUCT_ID,
    presentations: [
      {
        code: "BASE",
        conversionFactor: "1",
        conversionMode: "FIXED",
        id: "presentation-id",
        name: "Apresentação base",
        unit: { code: "KG", decimalScale: 4, id: "unit-id", name: "Quilograma" },
      },
    ],
    shortDescription: "Produto sintético",
    sku: "SKU-001",
    technicalDescription: "Ficha original",
  };

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(String(input), init);
      const url = new URL(request.url);
      const json = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
          headers: { "content-type": "application/json" },
          status,
        });

      if (url.pathname === "/api/v1/auth/session") {
        return json({ organizationId: "organization-id", role, userId: "user-id" });
      }

      const body =
        request.method === "PATCH" ? ((await request.clone().json()) as unknown) : undefined;
      requests.push({ body, method: request.method, pathname: url.pathname });

      if (url.pathname === "/api/v1/partners" && request.method === "GET") {
        return json({ items: [partner], limit: 20, offset: 0, total: 1 });
      }
      if (url.pathname === `/api/v1/partners/${PARTNER_ID}` && request.method === "PATCH") {
        const patch = body as { active?: boolean; roles?: string[] };
        if (patch.active !== undefined) partner.active = patch.active;
        if (patch.roles) partner.roles = patch.roles;
        return json({ partner, replayed: false });
      }
      if (url.pathname === "/api/v1/catalog/products" && request.method === "GET") {
        return json({
          items: [
            {
              active: product.active,
              baseUnit: product.baseUnit,
              id: product.id,
              shortDescription: product.shortDescription,
              sku: product.sku,
            },
          ],
          limit: 20,
          offset: 0,
          total: 1,
        });
      }
      if (url.pathname === `/api/v1/catalog/products/${PRODUCT_ID}`) {
        if (request.method === "PATCH") {
          const patch = body as {
            active?: boolean;
            shortDescription?: string;
            technicalDescription?: string;
          };
          if (patch.active !== undefined) product.active = patch.active;
          if (patch.shortDescription) product.shortDescription = patch.shortDescription;
          if (patch.technicalDescription !== undefined) {
            product.technicalDescription = patch.technicalDescription;
          }
          return json({ product, replayed: false });
        }
        return json({ product });
      }

      return json({ message: "not stubbed" }, 404);
    }),
  );

  return requests;
}

function renderAt(path: string) {
  window.history.pushState({}, "", path);
  return render(
    <AppProviders>
      <App />
    </AppProviders>,
  );
}

describe("edição de cadastros", () => {
  beforeEach(() => {
    writeSessionToken("session-token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSessionToken();
  });

  it("atualiza papéis e situação do parceiro com chave de idempotência", async () => {
    const requests = stubRegistryApi();
    const user = userEvent.setup();
    renderAt("/partners");

    await user.click(await screen.findByRole("button", { name: /Editar PARCEIRO SINTETICO/ }));
    const drawer = await screen.findByRole("dialog");
    await user.click(within(drawer).getByRole("checkbox", { name: "Fornecedor" }));
    await user.click(within(drawer).getByRole("checkbox", { name: "Parceiro ativo" }));
    await user.click(within(drawer).getByRole("button", { name: "Salvar parceiro" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const patch = requests.find((entry) => entry.method === "PATCH");
    expect(patch?.pathname).toBe(`/api/v1/partners/${PARTNER_ID}`);
    expect(patch?.body).toEqual({ active: false, roles: ["CUSTOMER", "SUPPLIER"] });
    expect(await screen.findByText("Inativo")).toBeInTheDocument();
  });

  it("bloqueia o envio do parceiro sem nenhum papel", async () => {
    stubRegistryApi();
    const user = userEvent.setup();
    renderAt("/partners");

    await user.click(await screen.findByRole("button", { name: /Editar PARCEIRO SINTETICO/ }));
    const drawer = await screen.findByRole("dialog");
    await user.click(within(drawer).getByRole("checkbox", { name: "Cliente" }));

    expect(within(drawer).getByText("Selecione ao menos um papel.")).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Salvar parceiro" })).toBeDisabled();
  });

  it("edita a descrição do produto e remove a ficha técnica com texto vazio", async () => {
    const requests = stubRegistryApi();
    const user = userEvent.setup();
    renderAt("/products");

    await user.click(await screen.findByRole("button", { name: /Editar SKU-001/ }));
    const drawer = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(within(drawer).getByLabelText("Descrição curta")).toHaveValue("Produto sintético"),
    );

    await user.clear(within(drawer).getByLabelText("Descrição curta"));
    await user.type(within(drawer).getByLabelText("Descrição curta"), "Produto revisado");
    await user.clear(within(drawer).getByLabelText("Descrição técnica"));
    await user.click(within(drawer).getByRole("button", { name: "Salvar produto" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const patch = requests.find((entry) => entry.method === "PATCH");
    expect(patch?.pathname).toBe(`/api/v1/catalog/products/${PRODUCT_ID}`);
    expect(patch?.body).toEqual({
      active: true,
      shortDescription: "Produto revisado",
      technicalDescription: "",
    });
    expect(await screen.findByText("Produto revisado")).toBeInTheDocument();
  });

  it("recusa descrição curta vazia antes de chamar a API", async () => {
    const requests = stubRegistryApi();
    const user = userEvent.setup();
    renderAt("/products");

    await user.click(await screen.findByRole("button", { name: /Editar SKU-001/ }));
    const drawer = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(within(drawer).getByLabelText("Descrição curta")).toHaveValue("Produto sintético"),
    );

    await user.clear(within(drawer).getByLabelText("Descrição curta"));
    await user.click(within(drawer).getByRole("button", { name: "Salvar produto" }));

    expect(await within(drawer).findByText("Informe a descrição curta")).toBeInTheDocument();
    expect(requests.some((entry) => entry.method === "PATCH")).toBe(false);
  });

  it("esconde a edição de membros sem papel administrativo", async () => {
    stubRegistryApi({ role: "MEMBER" });
    renderAt("/partners");

    await screen.findByRole("table");
    expect(screen.queryByRole("button", { name: /Editar/ })).not.toBeInTheDocument();
  });
});
