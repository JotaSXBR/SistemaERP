import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DiagnosticsPage } from "../src/pages/diagnostics-page.js";

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <DiagnosticsPage />
    </QueryClientProvider>,
  );
}

function requestUrl(input: RequestInfo | URL): string {
  return input instanceof Request ? input.url : String(input);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DiagnosticsPage", () => {
  it("shows API and database health returned by the generated client", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const isReadiness = requestUrl(input).endsWith("/api/v1/health/ready");

        return Promise.resolve(
          new Response(
            JSON.stringify(
              isReadiness ? { checks: { database: "up" }, status: "ok" } : { status: "ok" },
            ),
            {
              headers: {
                "content-type": "application/json",
                "x-request-id": isReadiness ? "req_database" : "req_api",
              },
              status: 200,
            },
          ),
        );
      }),
    );

    renderPage();

    expect(screen.getAllByRole("status")).toHaveLength(2);
    expect(await screen.findByText("req_api")).toBeInTheDocument();
    expect(await screen.findByText("req_database")).toBeInTheDocument();
    expect(screen.getAllByText("Operacional")).toHaveLength(2);
  });

  it("renders an actionable error state when the API is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: "SERVICE_UNAVAILABLE",
                details: {},
                message: "Serviço temporariamente indisponível",
                requestId: "req_failed",
              },
            }),
            { headers: { "content-type": "application/json" }, status: 503 },
          ),
        ),
      ),
    );

    renderPage();

    expect(await screen.findAllByText("Indisponível")).toHaveLength(2);
    expect(screen.getAllByText("A verificação falhou. Tente novamente.")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Verificar novamente" })).toBeEnabled();
  });
});
