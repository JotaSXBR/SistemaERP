import { render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/app/app.js";
import { AppProviders } from "../src/app/app-providers.js";
import { clearSessionToken, writeSessionToken } from "../src/shared/api/session-token.js";

type ListRequest = { pathname: string; query: URLSearchParams };

const PARTNER_PAGE_SIZE = 20;

function partner(index: number) {
  return {
    active: index % 5 !== 0,
    id: `1111111${index.toString().padStart(2, "0")}-1111-4111-8111-111111111111`,
    legalName: `PARCEIRO SINTETICO ${index}`,
    roles: index % 2 === 0 ? ["SUPPLIER"] : ["CUSTOMER"],
    taxId: `1111111111${index.toString().padStart(4, "0")}`,
    type: "ORGANIZATION",
    ...(index === 1 ? { tradeName: "APELIDO SINTETICO" } : {}),
  };
}

function product(index: number) {
  return {
    active: true,
    baseUnit: { code: "KG", decimalScale: 4, id: "unit-id", name: "Quilograma" },
    id: `2222222${index.toString().padStart(2, "0")}-2222-4222-8222-222222222222`,
    shortDescription: `Produto sintético ${index}`,
    sku: `SKU-${index.toString().padStart(3, "0")}`,
  };
}

function stubRegistryApi(options: { partnerTotal?: number; productTotal?: number } = {}) {
  const partnerTotal = options.partnerTotal ?? 3;
  const productTotal = options.productTotal ?? 2;
  const requests: ListRequest[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(String(input), init);
      const url = new URL(request.url);
      const json = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
          headers: { "content-type": "application/json" },
          status,
        });

      if (url.pathname === "/api/v1/auth/session") {
        return json({ organizationId: "organization-id", role: "OWNER", userId: "user-id" });
      }

      requests.push({ pathname: url.pathname, query: url.searchParams });
      const offset = Number(url.searchParams.get("offset") ?? "0");
      const search = url.searchParams.get("search");
      const role = url.searchParams.get("role");

      if (url.pathname === "/api/v1/partners") {
        const all = Array.from({ length: partnerTotal }, (_, index) => partner(index + 1)).filter(
          (candidate) =>
            (!search || candidate.legalName.includes(search)) &&
            (!role || candidate.roles.includes(role)),
        );
        return json({
          items: all.slice(offset, offset + PARTNER_PAGE_SIZE),
          limit: PARTNER_PAGE_SIZE,
          offset,
          total: all.length,
        });
      }

      if (url.pathname === "/api/v1/catalog/products") {
        const all = Array.from({ length: productTotal }, (_, index) => product(index + 1)).filter(
          (candidate) => !search || candidate.sku.includes(search),
        );
        return json({
          items: all.slice(offset, offset + PARTNER_PAGE_SIZE),
          limit: PARTNER_PAGE_SIZE,
          offset,
          total: all.length,
        });
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

describe("listagens de cadastro", () => {
  beforeEach(() => {
    writeSessionToken("session-token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSessionToken();
  });

  it("lista parceiros com identificador fiscal formatado e situação", async () => {
    stubRegistryApi();
    renderAt("/partners");

    expect(await screen.findByRole("heading", { name: "Parceiros" })).toBeInTheDocument();
    const table = await screen.findByRole("table");
    expect(await within(table).findByText("PARCEIRO SINTETICO 1")).toBeInTheDocument();
    expect(within(table).getByText("APELIDO SINTETICO")).toBeInTheDocument();
    expect(within(table).getByText("11.111.111/1100-01")).toBeInTheDocument();
    expect(within(table).getAllByText("Ativo").length).toBeGreaterThan(0);
    expect(screen.getByText("1–3 de 3")).toBeInTheDocument();
  });

  it("envia busca e papel como filtros da API de parceiros", async () => {
    const requests = stubRegistryApi();
    const user = userEvent.setup();
    renderAt("/partners");

    await screen.findByRole("table");
    await user.type(screen.getByLabelText("Buscar parceiro"), "SINTETICO 2");
    await user.selectOptions(screen.getByLabelText("Filtrar por papel"), "SUPPLIER");

    await waitFor(() => {
      const last = requests.at(-1);
      expect(last?.pathname).toBe("/api/v1/partners");
      expect(last?.query.get("search")).toBe("SINTETICO 2");
      expect(last?.query.get("role")).toBe("SUPPLIER");
    });
  });

  it("mostra estado vazio quando o filtro não encontra parceiros", async () => {
    stubRegistryApi();
    const user = userEvent.setup();
    renderAt("/partners");

    await screen.findByRole("table");
    await user.type(screen.getByLabelText("Buscar parceiro"), "INEXISTENTE");

    expect(
      await screen.findByText("Nenhum parceiro corresponde ao filtro aplicado."),
    ).toBeInTheDocument();
  });

  it("pagina a listagem de parceiros pelo deslocamento da API", async () => {
    const requests = stubRegistryApi({ partnerTotal: 25 });
    const user = userEvent.setup();
    renderAt("/partners");

    await screen.findByRole("table");
    expect(screen.getByText("1–20 de 25")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Próxima" }));

    await waitFor(() => expect(screen.getByText("21–25 de 25")).toBeInTheDocument());
    expect(requests.at(-1)?.query.get("offset")).toBe("20");
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
  });

  it("volta para a primeira página quando a busca muda", async () => {
    const requests = stubRegistryApi({ partnerTotal: 25 });
    const user = userEvent.setup();
    renderAt("/partners");

    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Próxima" }));
    await waitFor(() => expect(screen.getByText("21–25 de 25")).toBeInTheDocument());

    await user.type(screen.getByLabelText("Buscar parceiro"), "SINTETICO 2");

    await waitFor(() => {
      const last = requests.at(-1);
      expect(last?.query.get("search")).toBe("SINTETICO 2");
      expect(last?.query.get("offset")).toBe("0");
    });
  });

  it("lista produtos do catálogo com unidade base", async () => {
    stubRegistryApi();
    renderAt("/products");

    expect(await screen.findByRole("heading", { name: "Produtos" })).toBeInTheDocument();
    const table = await screen.findByRole("table");
    expect(within(table).getByText("SKU-001")).toBeInTheDocument();
    expect(within(table).getByText("Produto sintético 1")).toBeInTheDocument();
    expect(within(table).getAllByText("Quilograma (KG)").length).toBe(2);
  });

  it("permite tentar novamente quando a listagem de produtos falha", async () => {
    let attempt = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const request = input instanceof Request ? input : new Request(String(input), init);
        const { pathname } = new URL(request.url);
        if (pathname === "/api/v1/auth/session") {
          return new Response(
            JSON.stringify({ organizationId: "org", role: "OWNER", userId: "user" }),
            { headers: { "content-type": "application/json" }, status: 200 },
          );
        }
        attempt += 1;
        if (attempt <= 2) {
          return new Response(JSON.stringify({ message: "erro" }), {
            headers: { "content-type": "application/json" },
            status: 500,
          });
        }
        return new Response(
          JSON.stringify({ items: [product(1)], limit: PARTNER_PAGE_SIZE, offset: 0, total: 1 }),
          { headers: { "content-type": "application/json" }, status: 200 },
        );
      }),
    );

    const user = userEvent.setup();
    renderAt("/products");

    expect(
      await screen.findByText("Não foi possível carregar os registros.", undefined, {
        timeout: 3000,
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText("SKU-001")).toBeInTheDocument();
  });

  it("expõe os cadastros na navegação autenticada", async () => {
    stubRegistryApi();
    renderAt("/partners");

    await screen.findByRole("table");
    const navigation = screen.getByRole("navigation", { name: "Navegação principal" });
    expect(within(navigation).getByRole("link", { name: "Parceiros" })).toBeInTheDocument();
    expect(within(navigation).getByRole("link", { name: "Produtos" })).toBeInTheDocument();
  });
});
