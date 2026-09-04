import { render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/app/app.js";
import { AppProviders } from "../src/app/app-providers.js";
import { clearSessionToken, writeSessionToken } from "../src/shared/api/session-token.js";

type Recorded = { body: unknown; idempotencyKey: string | null; method: string; pathname: string };

/**
 * Cadastro vazio: as telas de criação partem da lista sem registros, que é o estado em que o
 * usuário chega para criar o primeiro parceiro ou produto.
 */
function stubEmptyRegistry(options: { conflict?: boolean; role?: string } = {}) {
  const role = options.role ?? "OWNER";
  const requests: Recorded[] = [];

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
        request.method === "POST" ? ((await request.clone().json()) as unknown) : undefined;
      requests.push({
        body,
        idempotencyKey: request.headers.get("idempotency-key"),
        method: request.method,
        pathname: url.pathname,
      });

      if (request.method === "GET") {
        return json({ items: [], limit: 20, offset: 0, total: 0 });
      }

      if (request.method === "POST") {
        if (options.conflict) return json({ message: "conflict" }, 409);
        if (url.pathname === "/api/v1/partners") {
          return json(
            {
              partner: {
                active: true,
                id: "11111111-1111-4111-8111-111111111111",
                legalName: "METALURGICA NOVA",
                roles: ["SUPPLIER"],
                taxId: "11222333000181",
                type: "ORGANIZATION",
              },
              replayed: false,
            },
            201,
          );
        }
        return json(
          {
            product: {
              active: true,
              basePresentation: {
                code: "BASE",
                conversionFactor: "1",
                conversionMode: "FIXED",
                id: "presentation-id",
                name: "Apresentação base",
                unit: { code: "KG", decimalScale: 3, id: "unit-id", name: "Quilograma" },
              },
              baseUnit: { code: "KG", decimalScale: 3, id: "unit-id", name: "Quilograma" },
              id: "22222222-2222-4222-8222-222222222222",
              shortDescription: "Vergalhão redondo 1020",
              sku: "VRG-1020-12",
            },
            replayed: false,
          },
          201,
        );
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

describe("criação de cadastros", () => {
  beforeEach(() => {
    writeSessionToken("session-token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSessionToken();
  });

  it("cadastra um parceiro com chave de idempotência e documento sem pontuação", async () => {
    const requests = stubEmptyRegistry();
    const user = userEvent.setup();
    renderAt("/partners");

    await user.click(await screen.findByRole("button", { name: "Novo parceiro" }));
    const drawer = await screen.findByRole("dialog");
    await user.type(within(drawer).getByLabelText("Razão social"), "METALURGICA NOVA");
    await user.type(within(drawer).getByLabelText("CPF/CNPJ"), "11.222.333/0001-81");
    await user.click(within(drawer).getByRole("checkbox", { name: "Fornecedor" }));
    await user.click(within(drawer).getByRole("button", { name: "Cadastrar parceiro" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const post = requests.find((entry) => entry.method === "POST");
    expect(post?.pathname).toBe("/api/v1/partners");
    expect(post?.idempotencyKey).toBeTruthy();
    expect(post?.body).toEqual({
      legalName: "METALURGICA NOVA",
      roles: ["SUPPLIER"],
      taxId: "11222333000181",
      type: "ORGANIZATION",
    });
  });

  it("recusa CPF quando o parceiro é pessoa jurídica sem chamar a API", async () => {
    const requests = stubEmptyRegistry();
    const user = userEvent.setup();
    renderAt("/partners");

    await user.click(await screen.findByRole("button", { name: "Novo parceiro" }));
    const drawer = await screen.findByRole("dialog");
    await user.type(within(drawer).getByLabelText("Razão social"), "METALURGICA NOVA");
    await user.type(within(drawer).getByLabelText("CPF/CNPJ"), "12345678901");
    await user.click(within(drawer).getByRole("checkbox", { name: "Fornecedor" }));
    await user.click(within(drawer).getByRole("button", { name: "Cadastrar parceiro" }));

    expect(
      await within(drawer).findByText("Pessoa jurídica exige CNPJ e pessoa física exige CPF"),
    ).toBeInTheDocument();
    expect(requests.some((entry) => entry.method === "POST")).toBe(false);
  });

  it("exige ao menos um papel antes de enviar o parceiro", async () => {
    const requests = stubEmptyRegistry();
    const user = userEvent.setup();
    renderAt("/partners");

    await user.click(await screen.findByRole("button", { name: "Novo parceiro" }));
    const drawer = await screen.findByRole("dialog");
    await user.type(within(drawer).getByLabelText("Razão social"), "METALURGICA NOVA");
    await user.type(within(drawer).getByLabelText("CPF/CNPJ"), "11222333000181");
    await user.click(within(drawer).getByRole("button", { name: "Cadastrar parceiro" }));

    expect(await within(drawer).findByText("Selecione ao menos um papel")).toBeInTheDocument();
    expect(requests.some((entry) => entry.method === "POST")).toBe(false);
  });

  it("cadastra um produto com a unidade base informada", async () => {
    const requests = stubEmptyRegistry();
    const user = userEvent.setup();
    renderAt("/products");

    await user.click(await screen.findByRole("button", { name: "Novo produto" }));
    const drawer = await screen.findByRole("dialog");
    await user.type(within(drawer).getByLabelText("SKU"), "VRG-1020-12");
    await user.type(within(drawer).getByLabelText("Descrição curta"), "Vergalhão redondo 1020");
    await user.type(within(drawer).getByLabelText("Código"), "KG");
    await user.type(within(drawer).getByLabelText("Nome"), "Quilograma");
    await user.clear(within(drawer).getByLabelText("Casas decimais"));
    await user.type(within(drawer).getByLabelText("Casas decimais"), "3");
    await user.click(within(drawer).getByRole("button", { name: "Cadastrar produto" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const post = requests.find((entry) => entry.method === "POST");
    expect(post?.pathname).toBe("/api/v1/catalog/products");
    expect(post?.idempotencyKey).toBeTruthy();
    expect(post?.body).toEqual({
      baseUnit: { code: "KG", decimalScale: 3, name: "Quilograma" },
      shortDescription: "Vergalhão redondo 1020",
      sku: "VRG-1020-12",
    });
  });

  it("explica o conflito de SKU sem fechar o formulário", async () => {
    stubEmptyRegistry({ conflict: true });
    const user = userEvent.setup();
    renderAt("/products");

    await user.click(await screen.findByRole("button", { name: "Novo produto" }));
    const drawer = await screen.findByRole("dialog");
    await user.type(within(drawer).getByLabelText("SKU"), "VRG-1020-12");
    await user.type(within(drawer).getByLabelText("Descrição curta"), "Vergalhão redondo 1020");
    await user.type(within(drawer).getByLabelText("Código"), "KG");
    await user.type(within(drawer).getByLabelText("Nome"), "Quilograma");
    await user.click(within(drawer).getByRole("button", { name: "Cadastrar produto" }));

    expect(
      await within(drawer).findByText("Já existe um produto com este SKU nesta empresa."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("não oferece criação para quem não pode escrever", async () => {
    stubEmptyRegistry({ role: "MEMBER" });
    renderAt("/partners");

    expect(await screen.findByText(/Nenhum parceiro cadastrado/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Novo parceiro" })).not.toBeInTheDocument();
  });
});
