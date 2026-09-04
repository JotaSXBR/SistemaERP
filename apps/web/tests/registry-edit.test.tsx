import { render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/app/app.js";
import { AppProviders } from "../src/app/app-providers.js";
import { clearSessionToken, writeSessionToken } from "../src/shared/api/session-token.js";

const PARTNER_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID = "22222222-2222-4222-8222-222222222222";
const DEFINITION_ID = "33333333-3333-4333-8333-333333333333";
const OPTION_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_OPTION_ID = "55555555-5555-4555-8555-555555555555";

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
  const definition = {
    active: true,
    code: "LIGA",
    id: DEFINITION_ID,
    name: "Liga",
    options: [
      { active: true, code: "SAE-1020", id: OPTION_ID, name: "SAE 1020" },
      { active: true, code: "SAE-1045", id: OTHER_OPTION_ID, name: "SAE 1045" },
    ],
  };
  const product = {
    active: true,
    attributes: [] as { definitionId: string; optionId: string }[],
    baseUnit: { code: "KG", decimalScale: 4, id: "unit-id", name: "Quilograma" },
    geometry: { thicknessMm: "3.18" } as Record<string, string>,
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
      if (url.pathname === "/api/v1/catalog/attribute-definitions" && request.method === "GET") {
        return json({ items: [definition] });
      }
      if (url.pathname === `/api/v1/catalog/products/${PRODUCT_ID}`) {
        if (request.method === "PATCH") {
          const patch = body as {
            active?: boolean;
            attributes?: { definitionId: string; optionId: string }[];
            geometry?: Record<string, string | null>;
            shortDescription?: string;
            technicalDescription?: string;
          };
          if (patch.active !== undefined) product.active = patch.active;
          if (patch.attributes) product.attributes = patch.attributes;
          if (patch.geometry) {
            // Espelha o contrato: medida nula deixa de existir na resposta, não vira zero.
            product.geometry = Object.fromEntries(
              Object.entries(patch.geometry).filter(([, measure]) => measure !== null),
            ) as Record<string, string>;
          }
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
      attributes: [],
      // O formulário mostra as oito medidas, então todas viajam: as em branco como nulo.
      geometry: {
        heightMm: null,
        innerDiameterMm: null,
        lengthMm: null,
        outerDiameterMm: null,
        thicknessMm: "3.18",
        weightPerMeterKg: null,
        weightPerSquareMeterKg: null,
        widthMm: null,
      },
      shortDescription: "Produto revisado",
      technicalDescription: "",
    });
    expect(await screen.findByText("Produto revisado")).toBeInTheDocument();
  });

  it("grava medidas digitadas com vírgula e mostra a polegada equivalente", async () => {
    const requests = stubRegistryApi();
    const user = userEvent.setup();
    renderAt("/products");

    await user.click(await screen.findByRole("button", { name: /Editar SKU-001/ }));
    const drawer = await screen.findByRole("dialog");
    await waitFor(() => expect(within(drawer).getByLabelText(/Espessura/)).toHaveValue("3,18"));

    // 3,18 mm é a "chapa 11" do setor, que equivale a 1/8".
    expect(within(drawer).getByText('1/8"')).toBeInTheDocument();

    await user.type(within(drawer).getByLabelText(/Largura/), "1200");
    await user.type(within(drawer).getByLabelText(/Peso por metro quadrado/), "24,964");
    await user.click(within(drawer).getByRole("button", { name: "Salvar produto" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const patch = requests.find((entry) => entry.method === "PATCH");
    const geometry = (patch?.body as { geometry: Record<string, string | null> }).geometry;
    // A vírgula é apresentação; a API recebe ponto.
    expect(geometry.weightPerSquareMeterKg).toBe("24.964");
    expect(geometry.widthMm).toBe("1200");
    expect(geometry.thicknessMm).toBe("3.18");
  });

  it("apaga a medida que deixou de se aplicar ao produto", async () => {
    const requests = stubRegistryApi();
    const user = userEvent.setup();
    renderAt("/products");

    await user.click(await screen.findByRole("button", { name: /Editar SKU-001/ }));
    const drawer = await screen.findByRole("dialog");
    await waitFor(() => expect(within(drawer).getByLabelText(/Espessura/)).toHaveValue("3,18"));

    await user.clear(within(drawer).getByLabelText(/Espessura/));
    await user.click(within(drawer).getByRole("button", { name: "Salvar produto" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const patch = requests.find((entry) => entry.method === "PATCH");
    const geometry = (patch?.body as { geometry: Record<string, string | null> }).geometry;
    // Campo em branco vira nulo, e nulo é "não se aplica" — nunca zero.
    expect(geometry.thicknessMm).toBeNull();
  });

  it("recusa medida zerada antes de chamar a API", async () => {
    const requests = stubRegistryApi();
    const user = userEvent.setup();
    renderAt("/products");

    await user.click(await screen.findByRole("button", { name: /Editar SKU-001/ }));
    const drawer = await screen.findByRole("dialog");
    await waitFor(() => expect(within(drawer).getByLabelText(/Espessura/)).toHaveValue("3,18"));

    await user.clear(within(drawer).getByLabelText(/Espessura/));
    await user.type(within(drawer).getByLabelText(/Espessura/), "0");
    await user.click(within(drawer).getByRole("button", { name: "Salvar produto" }));

    expect(
      await within(drawer).findByText("Informe um número maior que zero, ou deixe em branco."),
    ).toBeInTheDocument();
    expect(requests.some((entry) => entry.method === "PATCH")).toBe(false);
  });

  it("classifica o produto pelo eixo e remove a faceta ao escolher não classificado", async () => {
    const requests = stubRegistryApi();
    const user = userEvent.setup();
    renderAt("/products");

    await user.click(await screen.findByRole("button", { name: /Editar SKU-001/ }));
    const drawer = await screen.findByRole("dialog");
    await waitFor(() => expect(within(drawer).getByLabelText("Liga")).toBeInTheDocument());

    await user.selectOptions(within(drawer).getByLabelText("Liga"), OPTION_ID);
    await user.click(within(drawer).getByRole("button", { name: "Salvar produto" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const patch = requests.find((entry) => entry.method === "PATCH");
    expect((patch?.body as { attributes: unknown }).attributes).toEqual([
      { definitionId: DEFINITION_ID, optionId: OPTION_ID },
    ]);

    // A faceta gravada volta selecionada, e "Não classificado" a remove do conjunto.
    await user.click(await screen.findByRole("button", { name: /Editar SKU-001/ }));
    const reopened = await screen.findByRole("dialog");
    await waitFor(() => expect(within(reopened).getByLabelText("Liga")).toHaveValue(OPTION_ID));

    await user.selectOptions(within(reopened).getByLabelText("Liga"), "");
    await user.click(within(reopened).getByRole("button", { name: "Salvar produto" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const last = requests.filter((entry) => entry.method === "PATCH").at(-1);
    expect((last?.body as { attributes: unknown }).attributes).toEqual([]);
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
