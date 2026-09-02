import { render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/app/app.js";
import { AppProviders } from "../src/app/app-providers.js";
import { clearSessionToken } from "../src/shared/api/session-token.js";

const SESSION_TOKEN = "opaque-session-token";

type RecordedRequest = { authorization: string | null; method: string; pathname: string };

function stubApi(options: { credentialsAccepted?: boolean } = {}) {
  const accepted = options.credentialsAccepted ?? true;
  const recorded: RecordedRequest[] = [];
  let issuedToken: string | undefined;

  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    const { pathname } = new URL(request.url);
    const authorization = request.headers.get("authorization");

    recorded.push({ authorization, method: request.method, pathname });

    const json = (body: unknown, status: number) =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          headers: { "content-type": "application/json" },
          status,
        }),
      );

    if (pathname === "/api/v1/auth/sessions" && request.method === "POST") {
      if (!accepted) {
        return json({ error: { code: "UNAUTHORIZED" } }, 401);
      }

      issuedToken = SESSION_TOKEN;

      return json(
        {
          expiresAt: "2026-09-02T20:00:00.000Z",
          organizationId: "11111111-1111-4111-8111-111111111111",
          role: "OWNER",
          token: SESSION_TOKEN,
          userId: "22222222-2222-4222-8222-222222222222",
        },
        201,
      );
    }

    const authenticated = authorization === `Bearer ${issuedToken}` && issuedToken !== undefined;

    if (pathname === "/api/v1/auth/sessions/current/revoke") {
      issuedToken = undefined;

      return Promise.resolve(new Response(null, { status: 204 }));
    }

    if (!authenticated) {
      return json({ error: { code: "UNAUTHORIZED" } }, 401);
    }

    if (pathname === "/api/v1/auth/session") {
      return json(
        {
          organizationId: "11111111-1111-4111-8111-111111111111",
          role: "OWNER",
          userId: "22222222-2222-4222-8222-222222222222",
        },
        200,
      );
    }

    if (pathname === "/api/v1/organizations/current") {
      return json(
        { id: "11111111-1111-4111-8111-111111111111", name: "Empresa Sintética", slug: "demo" },
        200,
      );
    }

    return json({ error: { code: "RESOURCE_NOT_FOUND" } }, 404);
  });

  vi.stubGlobal("fetch", fetchMock);

  return recorded;
}

function renderApp(path: string) {
  window.history.pushState({}, "", path);

  return render(
    <AppProviders>
      <App />
    </AppProviders>,
  );
}

async function fillLogin() {
  const user = userEvent.setup();

  await user.type(screen.getByLabelText("E-mail"), "admin@example.test");
  await user.type(screen.getByLabelText("Empresa"), "demo");
  await user.type(screen.getByLabelText("Senha"), "local_admin_only");
  await user.click(screen.getByRole("button", { name: "Entrar" }));
}

beforeEach(() => {
  clearSessionToken();
});

afterEach(() => {
  clearSessionToken();
  vi.unstubAllGlobals();
});

describe("autenticação da aplicação web", () => {
  it("envia visitante anônimo para o login antes de abrir uma rota protegida", async () => {
    stubApi();

    renderApp("/organization");

    expect(
      await screen.findByRole("heading", { name: "Entrar no Sistema ERP" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Empresa atual" })).not.toBeInTheDocument();
  });

  it("autentica, retorna à rota pretendida e assina as requisições com o token", async () => {
    const recorded = stubApi();

    renderApp("/organization");
    await screen.findByRole("heading", { name: "Entrar no Sistema ERP" });
    await fillLogin();

    expect(await screen.findByRole("heading", { name: "Empresa atual" })).toBeInTheDocument();
    expect(await screen.findByText("Empresa Sintética")).toBeInTheDocument();

    const organizationSection = within(screen.getByRole("region", { name: "Dados da empresa" }));
    expect(organizationSection.getByText("demo")).toBeInTheDocument();
    expect(organizationSection.getByText("Proprietário")).toBeInTheDocument();

    const organizationRequest = recorded.find(
      ({ pathname }) => pathname === "/api/v1/organizations/current",
    );
    expect(organizationRequest?.authorization).toBe(`Bearer ${SESSION_TOKEN}`);

    const loginRequest = recorded.find(({ pathname }) => pathname === "/api/v1/auth/sessions");
    expect(loginRequest?.authorization).toBeNull();
  });

  it("mostra credencial recusada sem abrir a rota protegida", async () => {
    stubApi({ credentialsAccepted: false });

    renderApp("/login");
    await screen.findByRole("heading", { name: "Entrar no Sistema ERP" });
    await fillLogin();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "E-mail, senha ou empresa não conferem.",
    );
    expect(screen.queryByRole("heading", { name: "Empresa atual" })).not.toBeInTheDocument();
  });

  it("valida a entrada no cliente antes de chamar a API", async () => {
    const recorded = stubApi();
    const user = userEvent.setup();

    renderApp("/login");
    await screen.findByRole("heading", { name: "Entrar no Sistema ERP" });

    await user.type(screen.getByLabelText("E-mail"), "sem-arroba");
    await user.type(screen.getByLabelText("Empresa"), "demo");
    await user.type(screen.getByLabelText("Senha"), "curta");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Informe um e-mail válido")).toBeInTheDocument();
    expect(screen.getByText("A senha precisa ter ao menos 8 caracteres")).toBeInTheDocument();
    expect(recorded.some(({ pathname }) => pathname === "/api/v1/auth/sessions")).toBe(false);
  });

  it("encerra a sessão e volta a exigir autenticação", async () => {
    const recorded = stubApi();
    const user = userEvent.setup();

    renderApp("/organization");
    await screen.findByRole("heading", { name: "Entrar no Sistema ERP" });
    await fillLogin();
    await screen.findByRole("heading", { name: "Empresa atual" });

    await user.click(screen.getByRole("button", { name: "Sair" }));

    expect(
      await screen.findByRole("heading", { name: "Entrar no Sistema ERP" }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(window.sessionStorage.getItem("sistema-erp.session-token")).toBeNull();
    });
    expect(
      recorded.some(({ pathname }) => pathname === "/api/v1/auth/sessions/current/revoke"),
    ).toBe(true);
  });
});
