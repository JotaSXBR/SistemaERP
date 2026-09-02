import { randomUUID } from "node:crypto";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDatabaseClient,
  FiscalIngestionSource,
  ProductConversionMode,
  type DatabaseClient,
} from "../src/index.js";

const ACCESS_KEY = "1".repeat(44);

function documentData(organizationId: string, accessKey = ACCESS_KEY) {
  return {
    accessKey,
    documentNumber: "123",
    documentTotal: "1234.5600",
    issuedAt: new Date("2026-09-01T12:00:00.000Z"),
    natureOfOperation: "Compra sintética",
    organizationId,
    recipientTaxId: "22222222222222",
    schemaVersion: "4.00",
    series: "1",
    supplierName: "Fornecedor sintético",
    supplierTaxId: "11111111111111",
  };
}

function itemData(documentId: string, organizationId: string) {
  return {
    cfop: "1102",
    commercialQuantity: "0.1000000000",
    commercialUnit: "KG",
    commercialUnitValue: "12345.6000000000",
    description: "Produto sintético",
    documentId,
    itemNumber: "1",
    ncm: "72162100",
    organizationId,
    supplierCode: "000123",
    taxableQuantity: "0.1000000000",
    taxableUnit: "KG",
    taxableUnitValue: "12345.6000000000",
    totalValue: "1234.5600",
  };
}

describe("fiscal inbox persistence", () => {
  let database: DatabaseClient;
  let organizationAId: string;
  let organizationBId: string;
  let presentationBId: string;

  beforeAll(async () => {
    try {
      loadEnvFile(fileURLToPath(new URL("../../../.env", import.meta.url)));
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
        throw error;
      }
    }

    database = createDatabaseClient();
    const suffix = randomUUID().slice(0, 8);
    const [organizationA, organizationB] = await Promise.all([
      database.organization.create({
        data: { name: "Fiscal Inbox Tenant A", slug: `fiscal-inbox-a-${suffix}` },
      }),
      database.organization.create({
        data: { name: "Fiscal Inbox Tenant B", slug: `fiscal-inbox-b-${suffix}` },
      }),
    ]);
    organizationAId = organizationA.id;
    organizationBId = organizationB.id;

    const unitB = await database.unitOfMeasure.create({
      data: { code: "KG", name: "Quilograma", organizationId: organizationBId },
    });
    const productB = await database.product.create({
      data: {
        baseUnitId: unitB.id,
        organizationId: organizationBId,
        shortDescription: "Produto do tenant B",
        sku: "FISCAL-TENANT-B",
      },
    });
    const presentationB = await database.productPresentation.create({
      data: {
        code: "BASE",
        conversionFactor: "1",
        conversionMode: ProductConversionMode.FIXED,
        name: "Base",
        organizationId: organizationBId,
        productId: productB.id,
        unitOfMeasureId: unitB.id,
      },
    });
    presentationBId = presentationB.id;
  });

  afterAll(async () => {
    await database.inboundFiscalDocumentItemMapping.deleteMany({
      where: { organizationId: { in: [organizationAId, organizationBId] } },
    });
    await database.fiscalDocumentIngestion.deleteMany({
      where: { organizationId: { in: [organizationAId, organizationBId] } },
    });
    await database.inboundFiscalDocumentItem.deleteMany({
      where: { organizationId: { in: [organizationAId, organizationBId] } },
    });
    await database.inboundFiscalDocument.deleteMany({
      where: { organizationId: { in: [organizationAId, organizationBId] } },
    });
    await database.productPresentation.deleteMany({ where: { organizationId: organizationBId } });
    await database.product.deleteMany({ where: { organizationId: organizationBId } });
    await database.unitOfMeasure.deleteMany({ where: { organizationId: organizationBId } });
    await database.organization.deleteMany({
      where: { id: { in: [organizationAId, organizationBId] } },
    });
    await database.$disconnect();
  });

  it("persists exact fiscal values and deduplicates access keys per organization", async () => {
    const documentA = await database.inboundFiscalDocument.create({
      data: documentData(organizationAId),
    });
    const item = await database.inboundFiscalDocumentItem.create({
      data: itemData(documentA.id, organizationAId),
    });
    const ingestion = await database.fiscalDocumentIngestion.create({
      data: {
        byteSize: 2048n,
        contentType: "application/xml",
        correlationId: "correlation_fiscal_inbox",
        documentId: documentA.id,
        hashSha256: "a".repeat(64),
        objectKey: `${organizationAId}/fiscal-intake/${documentA.id}/original.xml`,
        organizationId: organizationAId,
        requestId: "req_fiscal_inbox",
        source: FiscalIngestionSource.MANUAL_UPLOAD,
      },
    });

    await expect(
      database.inboundFiscalDocument.create({ data: documentData(organizationAId) }),
    ).rejects.toThrow();
    await expect(
      database.inboundFiscalDocument.create({ data: documentData(organizationBId) }),
    ).resolves.toMatchObject({ accessKey: ACCESS_KEY, organizationId: organizationBId });
    expect(documentA.documentTotal.toString()).toBe("1234.56");
    expect(item.commercialQuantity.toString()).toBe("0.1");
    expect(item.commercialUnitValue.toString()).toBe("12345.6");
    expect(ingestion.byteSize).toBe(2048n);
  });

  it("rejects cross-tenant document items and product mappings", async () => {
    const documentA = await database.inboundFiscalDocument.create({
      data: documentData(organizationAId, "2".repeat(44)),
    });
    const itemA = await database.inboundFiscalDocumentItem.create({
      data: itemData(documentA.id, organizationAId),
    });

    await expect(
      database.inboundFiscalDocumentItem.create({
        data: { ...itemData(documentA.id, organizationBId), itemNumber: "2" },
      }),
    ).rejects.toThrow();
    await expect(
      database.inboundFiscalDocumentItemMapping.create({
        data: {
          documentItemId: itemA.id,
          organizationId: organizationAId,
          productPresentationId: presentationBId,
        },
      }),
    ).rejects.toThrow();
  });

  it("enforces deterministic fiscal and object metadata constraints", async () => {
    await expect(
      database.inboundFiscalDocument.create({
        data: documentData(organizationAId, "invalid-access-key"),
      }),
    ).rejects.toThrow();

    const documentA = await database.inboundFiscalDocument.create({
      data: documentData(organizationAId, "3".repeat(44)),
    });

    await expect(
      database.fiscalDocumentIngestion.create({
        data: {
          byteSize: 5_242_881n,
          contentType: "application/xml",
          correlationId: "correlation_invalid_ingestion",
          documentId: documentA.id,
          hashSha256: "invalid-hash",
          objectKey: "object.xml",
          organizationId: organizationAId,
          requestId: "req_invalid_ingestion",
          source: FiscalIngestionSource.MANUAL_UPLOAD,
        },
      }),
    ).rejects.toThrow();
  });
});
