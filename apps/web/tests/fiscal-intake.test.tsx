import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/app/app.js";
import { AppProviders } from "../src/app/app-providers.js";
import { clearSessionToken, writeSessionToken } from "../src/shared/api/session-token.js";

const DOCUMENT_ID = "11111111-1111-4111-8111-111111111111";
const PARTNER_ID = "22222222-2222-4222-8222-222222222222";
const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";
const PRESENTATION_ID = "44444444-4444-4444-8444-444444444444";
const ITEM_ID = "55555555-5555-4555-8555-555555555555";
const INGESTION_ID = "66666666-6666-4666-8666-666666666666";

type Stage = "mapping" | "ready" | "supplier" | "validation";

function persistentDocument(stage: Stage) {
  const supplierFound = stage !== "supplier";
  const matched = stage === "ready";
  const validationFailed = stage === "validation";
  return {
    accessKey: "1".repeat(44),
    documentId: DOCUMENT_ID,
    documentNumber: "42",
    documentTotal: "1234.56",
    hashSha256: "a".repeat(64),
    ingestionId: INGESTION_ID,
    issuedAt: "2026-08-31T13:30:00.000Z",
    items: [
      {
        cfop: "1102",
        commercialQuantity: "0.1",
        commercialUnit: "KG",
        commercialUnitValue: "12345.6",
        description: "PERFIL METÁLICO SINTÉTICO",
        id: ITEM_ID,
        itemNumber: "1",
        ncm: "00000000",
        resolution: matched
          ? {
              product: {
                presentationCode: "BASE",
                presentationId: PRESENTATION_ID,
                presentationName: "Apresentação base",
                productId: PRODUCT_ID,
                shortDescription: "Perfil metálico",
                sku: "SKU-001",
                unit: { code: "KG", decimalScale: 4, id: PRESENTATION_ID, name: "Quilograma" },
              },
              status: "MATCHED",
            }
          : { status: supplierFound ? "UNMAPPED" : "SUPPLIER_NOT_FOUND" },
        supplierCode: "000123",
        taxableQuantity: "0.1",
        taxableUnit: "KG",
        taxableUnitValue: "12345.6",
        totalValue: "1234.56",
      },
    ],
    natureOfOperation: "COMPRA",
    recipientTaxId: "22222222222222",
    schemaVersion: "4.00",
    series: "1",
    status: validationFailed
      ? "VALIDATION_FAILED"
      : stage === "supplier"
        ? "PENDING_SUPPLIER"
        : stage === "mapping"
          ? "PENDING_MAPPING"
          : "READY_FOR_REVIEW",
    summary: {
      matched: matched ? 1 : 0,
      supplierNotFound: stage === "supplier" ? 1 : 0,
      unmapped: stage === "mapping" ? 1 : 0,
    },
    supplier: {
      name: "FORNECEDOR SINTÉTICO",
      ...(supplierFound ? { partnerId: PARTNER_ID } : {}),
      resolution: supplierFound ? "FOUND" : "NOT_FOUND",
      taxId: "11111111111111",
    },
    validation: validationFailed
      ? { issues: ["RECIPIENT_TAX_ID_MISMATCH"], status: "FAILED" }
      : { issues: [], status: "PASSED" },
  };
}

function stubFiscalApi(initialStage: Stage = "supplier") {
  let stage = initialStage;
  const requests: Array<{ method: string; pathname: string }> = [];

  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(String(input), init);
      const { pathname } = new URL(request.url);
      requests.push({ method: request.method, pathname });
      const json = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
          headers: { "content-type": "application/json" },
          status,
        });

      if (pathname === "/api/v1/auth/session") {
        return json({ organizationId: "organization-id", role: "OWNER", userId: "user-id" });
      }
      if (pathname === "/api/v1/fiscal-intake/nfe/documents" && request.method === "GET") {
        const current = persistentDocument(stage);
        return json({
          items: [
            {
              accessKey: current.accessKey,
              createdAt: "2026-09-02T12:00:00.000Z",
              documentId: DOCUMENT_ID,
              documentNumber: current.documentNumber,
              documentTotal: current.documentTotal,
              itemCount: 1,
              issuedAt: current.issuedAt,
              status: current.status,
              supplierName: current.supplier.name,
              supplierTaxId: current.supplier.taxId,
            },
          ],
          limit: 50,
          offset: 0,
          total: 1,
        });
      }
      if (pathname === `/api/v1/fiscal-intake/nfe/documents/${DOCUMENT_ID}`) {
        return json(persistentDocument(stage));
      }
      if (pathname === "/api/v1/partners" && request.method === "POST") {
        return json({ partner: { id: PARTNER_ID }, replayed: false }, 201);
      }
      if (pathname.endsWith("/resolve") && request.method === "POST") {
        stage = stage === "supplier" ? "mapping" : "ready";
        return json(persistentDocument(stage));
      }
      if (pathname === "/api/v1/catalog/products" && request.method === "GET") {
        return json({
          items: [
            {
              active: true,
              baseUnit: { code: "KG", decimalScale: 4, id: PRESENTATION_ID, name: "Quilograma" },
              id: PRODUCT_ID,
              shortDescription: "Perfil metálico",
              sku: "SKU-001",
            },
          ],
          limit: 100,
          offset: 0,
          total: 1,
        });
      }
      if (pathname === `/api/v1/catalog/products/${PRODUCT_ID}`) {
        return json({
          product: {
            active: true,
            baseUnit: { code: "KG", decimalScale: 4, id: PRESENTATION_ID, name: "Quilograma" },
            id: PRODUCT_ID,
            presentations: [
              {
                code: "BASE",
                conversionFactor: "1",
                conversionMode: "FIXED",
                id: PRESENTATION_ID,
                name: "Apresentação base",
                unit: { code: "KG", decimalScale: 4, id: PRESENTATION_ID, name: "Quilograma" },
              },
            ],
            shortDescription: "Perfil metálico",
            sku: "SKU-001",
          },
        });
      }
      if (pathname === "/api/v1/catalog/supplier-mappings" && request.method === "POST") {
        return json({ mapping: { id: "mapping-id" }, replayed: false }, 201);
      }
      if (pathname === "/api/v1/fiscal-intake/nfe/ingestions" && request.method === "POST") {
        return json({ ...persistentDocument(stage), replayed: false }, 201);
      }

      return json({ error: { code: "RESOURCE_NOT_FOUND" } }, 404);
    }),
  );

  return requests;
}

function renderPage() {
  window.history.pushState({}, "", "/fiscal-intake");
  return render(
    <AppProviders>
      <App />
    </AppProviders>,
  );
}

beforeEach(() => {
  writeSessionToken("opaque-session-token");
});

afterEach(() => {
  clearSessionToken();
  vi.unstubAllGlobals();
});

describe("inbox fiscal guiada", () => {
  it("resolve fornecedor e mapping até deixar o documento pronto para revisão", async () => {
    const requests = stubFiscalApi();
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("heading", { name: "Inbox de NF-e" })).toBeInTheDocument();
    expect(await screen.findByText("Fornecedor precisa de atenção")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Resolver fornecedor" }));
    expect(screen.getByRole("dialog", { name: "Resolver fornecedor" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cadastrar fornecedor" }));

    expect(await screen.findByRole("button", { name: "Mapear produto" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mapear produto" }));
    await user.selectOptions(await screen.findByLabelText("Produto"), PRODUCT_ID);
    await user.selectOptions(await screen.findByLabelText("Apresentação"), PRESENTATION_ID);
    await user.click(screen.getByRole("button", { name: "Confirmar mapping" }));

    expect(await screen.findByText("Documento pronto para revisão")).toBeInTheDocument();
    expect(screen.getByText(/recebimento será habilitada na Fase 8.3/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /confirmar recebimento/i }),
    ).not.toBeInTheDocument();
    expect(
      requests.some(
        ({ method, pathname }) =>
          method === "POST" && pathname === "/api/v1/catalog/supplier-mappings",
      ),
    ).toBe(true);
  });

  it("envia o arquivo XML pelo cliente gerado", async () => {
    const requests = stubFiscalApi();
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "Inbox de NF-e" });

    await user.upload(
      screen.getByLabelText("XML da NF-e"),
      new File(["<xml />"], "entrada.xml", { type: "application/xml" }),
    );
    await user.click(screen.getByRole("button", { name: "Importar XML" }));

    await waitFor(() => {
      expect(
        requests.some(
          ({ method, pathname }) =>
            method === "POST" && pathname === "/api/v1/fiscal-intake/nfe/ingestions",
        ),
      ).toBe(true);
    });
  });

  it("explica a falha de destinatário e bloqueia o mapping até a revalidação", async () => {
    stubFiscalApi("validation");
    renderPage();

    expect(await screen.findByText("O documento falhou na validação")).toBeInTheDocument();
    expect(
      screen.getByText("O destinatário do XML não corresponde à empresa atual."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revalidar documento" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mapear produto" })).not.toBeInTheDocument();
  });
});
