import { createHash, randomUUID } from "node:crypto";

import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { FiscalDocumentStatus, FiscalIngestionSource, Prisma } from "@sistema-erp/database";

import type {
  MappedProductDto,
  ResolveSupplierProductResponseDto,
} from "../catalog/catalog.dto.js";
import { CatalogService, type SupplierDocumentResolution } from "../catalog/catalog.service.js";
import { DatabaseService } from "../database/database.service.js";
import { RequestContextService } from "../request-context/request-context.service.js";
import { ObjectStorageIntegrityError, type ObjectStorage } from "./application/object-storage.js";
import type {
  CreateNfeIngestionResponseDto,
  NfeInboxListResponseDto,
  NfePersistentIntakeDto,
} from "./fiscal-intake.dto.js";
import { OBJECT_STORAGE } from "./infrastructure/runtime-object-storage.js";
import { parseNfeXml, type NfeXmlItem, type ParsedNfeXml } from "./nfe-xml.parser.js";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export type NfeIntakePreviewItem = NfeXmlItem & {
  resolution: ResolveSupplierProductResponseDto;
};

export type NfeIntakePreview = Omit<ParsedNfeXml, "items"> & {
  items: NfeIntakePreviewItem[];
  summary: { matched: number; supplierNotFound: number; unmapped: number };
};

export type SupplierProductResolver = Pick<
  CatalogService,
  "resolveSupplierDocument" | "resolveSupplierProducts"
>;

function xmlText(xml: string | Uint8Array): string {
  return typeof xml === "string" ? xml : Buffer.from(xml).toString("utf8");
}

function originalBytes(xml: string | Uint8Array): Uint8Array {
  return typeof xml === "string" ? Buffer.from(xml, "utf8") : xml;
}

function statusFor(resolution: SupplierDocumentResolution): FiscalDocumentStatus {
  if (resolution.supplierStatus !== "FOUND") {
    return FiscalDocumentStatus.PENDING_SUPPLIER;
  }
  return resolution.resolutions.every(({ status }) => status === "MATCHED")
    ? FiscalDocumentStatus.READY_FOR_REVIEW
    : FiscalDocumentStatus.PENDING_MAPPING;
}

@Injectable()
export class FiscalIntakeService {
  constructor(
    @Inject(CatalogService) private readonly catalog: SupplierProductResolver,
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(OBJECT_STORAGE) private readonly objectStorage: ObjectStorage,
    @Inject(RequestContextService) private readonly requestContext: RequestContextService,
  ) {}

  async preview(xml: string | Uint8Array): Promise<NfeIntakePreview> {
    const document = parseNfeXml(xmlText(xml));
    const resolutions = await this.catalog.resolveSupplierProducts(
      document.supplierTaxId,
      document.items.map(({ supplierCode }) => supplierCode),
    );
    const summary = { matched: 0, supplierNotFound: 0, unmapped: 0 };
    const items = document.items.map((item, index) => {
      const resolution = resolutions[index];
      if (!resolution) throw new Error("Supplier product resolution is incomplete");
      if (resolution.status === "MATCHED") summary.matched += 1;
      else if (resolution.status === "SUPPLIER_NOT_FOUND") summary.supplierNotFound += 1;
      else summary.unmapped += 1;

      return {
        ...item,
        resolution:
          resolution.status === "MATCHED"
            ? { mapping: resolution.mapping, status: resolution.status }
            : { status: resolution.status },
      };
    });
    return { ...document, items, summary };
  }

  async list(input: { limit: number; offset: number }): Promise<NfeInboxListResponseDto> {
    const { organizationId } = this.requestContext.getAuthenticated();
    const where = { organizationId };
    const [documents, total] = await Promise.all([
      this.database.value.inboundFiscalDocument.findMany({
        include: { _count: { select: { items: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: input.offset,
        take: input.limit,
        where,
      }),
      this.database.value.inboundFiscalDocument.count({ where }),
    ]);

    return {
      items: documents.map((document) => ({
        accessKey: document.accessKey,
        createdAt: document.createdAt.toISOString(),
        documentId: document.id,
        documentNumber: document.documentNumber,
        documentTotal: document.documentTotal.toString(),
        itemCount: document._count.items,
        issuedAt: document.issuedAt.toISOString(),
        status: document.status,
        supplierName: document.supplierName,
        supplierTaxId: document.supplierTaxId,
      })),
      limit: input.limit,
      offset: input.offset,
      total,
    };
  }

  findById(documentId: string): Promise<NfePersistentIntakeDto> {
    return this.loadDocument(documentId);
  }

  async ingest(
    xml: string | Uint8Array,
    contentType: "application/xml" | "text/xml",
    idempotencyKey: string,
  ): Promise<CreateNfeIngestionResponseDto> {
    if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      throw new ConflictException("Invalid idempotency key");
    }

    const context = this.requestContext.getAuthenticated();
    const bytes = originalBytes(xml);
    const hashSha256 = createHash("sha256").update(bytes).digest("hex");
    const idempotencyKeyHash = createHash("sha256").update(idempotencyKey).digest("hex");
    const parsed = { ...parseNfeXml(xmlText(xml)), hashSha256 };
    const keyReplay = await this.database.value.fiscalDocumentIngestion.findUnique({
      where: {
        organizationId_idempotencyKeyHash: {
          idempotencyKeyHash,
          organizationId: context.organizationId,
        },
      },
    });
    if (keyReplay) {
      if (keyReplay.hashSha256 !== hashSha256 || keyReplay.contentType !== contentType) {
        throw new ConflictException("Idempotency key is already in use");
      }
      return { ...(await this.loadDocument(keyReplay.documentId)), replayed: true };
    }

    const documentReplay = await this.findDocumentReplay(parsed.accessKey, hashSha256);
    if (documentReplay) {
      return { ...(await this.loadDocument(documentReplay)), replayed: true };
    }

    const resolution = await this.catalog.resolveSupplierDocument(
      parsed.supplierTaxId,
      parsed.items.map(({ supplierCode }) => supplierCode),
    );
    const documentId = randomUUID();
    const itemIds = parsed.items.map(() => randomUUID());
    const stored = await this.objectStorage.put({
      body: bytes,
      contentType,
      key: `${context.organizationId}/fiscal-intake/nfe/${idempotencyKeyHash}.xml`,
      sha256: hashSha256,
    });
    const verified = await this.objectStorage.head({
      key: stored.key,
      ...(stored.versionId ? { versionId: stored.versionId } : {}),
    });
    if (
      !verified ||
      verified.contentLength !== bytes.byteLength ||
      verified.contentType !== contentType ||
      verified.sha256 !== hashSha256
    ) {
      throw new ObjectStorageIntegrityError("Stored XML failed metadata verification");
    }

    let persistence: { documentId: string; replayed: boolean };
    try {
      const result = await this.database.value.$transaction(
        async (transaction) => {
          const existing = await transaction.inboundFiscalDocument.findUnique({
            include: { ingestions: { select: { hashSha256: true } } },
            where: {
              organizationId_accessKey: {
                accessKey: parsed.accessKey,
                organizationId: context.organizationId,
              },
            },
          });
          if (existing) {
            if (!existing.ingestions.some((ingestion) => ingestion.hashSha256 === hashSha256)) {
              throw new ConflictException("Access key already exists with different XML content");
            }
            return { documentId: existing.id, replayed: true };
          }

          await transaction.inboundFiscalDocument.create({
            data: {
              accessKey: parsed.accessKey,
              documentNumber: parsed.documentNumber,
              documentTotal: parsed.documentTotal,
              id: documentId,
              issuedAt: new Date(parsed.issuedAt),
              natureOfOperation: parsed.natureOfOperation,
              organizationId: context.organizationId,
              ...(parsed.protocol ? { protocol: parsed.protocol } : {}),
              recipientTaxId: parsed.recipientTaxId,
              schemaVersion: parsed.schemaVersion,
              series: parsed.series,
              status: statusFor(resolution),
              supplierName: parsed.supplierName,
              supplierTaxId: parsed.supplierTaxId,
            },
          });
          await transaction.inboundFiscalDocumentItem.createMany({
            data: parsed.items.map((item, index) => ({
              ...item,
              documentId,
              id: itemIds[index]!,
              organizationId: context.organizationId,
            })),
          });
          const mappings = resolution.resolutions.flatMap((itemResolution, index) =>
            itemResolution.status === "MATCHED"
              ? [
                  {
                    documentItemId: itemIds[index]!,
                    organizationId: context.organizationId,
                    productPresentationId: itemResolution.mapping.product.presentationId,
                  },
                ]
              : [],
          );
          if (mappings.length > 0) {
            await transaction.inboundFiscalDocumentItemMapping.createMany({ data: mappings });
          }
          await transaction.fiscalDocumentIngestion.create({
            data: {
              byteSize: BigInt(bytes.byteLength),
              contentType,
              correlationId: context.correlationId,
              documentId,
              hashSha256,
              idempotencyKeyHash,
              objectKey: verified.key,
              ...(verified.versionId ? { objectVersionId: verified.versionId } : {}),
              organizationId: context.organizationId,
              requestId: context.requestId,
              source: FiscalIngestionSource.MANUAL_UPLOAD,
            },
          });
          await transaction.auditEvent.create({
            data: {
              action: "fiscal-intake.nfe.ingested",
              actorUserId: context.userId,
              correlationId: context.correlationId,
              entityId: documentId,
              entityType: "inbound_fiscal_document",
              metadata: {
                itemCount: parsed.items.length,
                source: FiscalIngestionSource.MANUAL_UPLOAD,
                status: statusFor(resolution),
              },
              organizationId: context.organizationId,
              requestId: context.requestId,
            },
          });
          return { documentId, replayed: false };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      persistence = result;
    } catch (error) {
      const concurrentReplay = await this.findDocumentReplay(parsed.accessKey, hashSha256);
      if (!concurrentReplay) throw error;
      persistence = { documentId: concurrentReplay, replayed: true };
    }

    return {
      ...(await this.loadDocument(persistence.documentId)),
      replayed: persistence.replayed,
    };
  }

  async resolve(documentId: string): Promise<NfePersistentIntakeDto> {
    const context = this.requestContext.getAuthenticated();
    const document = await this.database.value.inboundFiscalDocument.findUnique({
      include: {
        items: { include: { internalProductMapping: true }, orderBy: { itemNumber: "asc" } },
      },
      where: { id_organizationId: { id: documentId, organizationId: context.organizationId } },
    });
    if (!document) throw new NotFoundException();

    const resolution = await this.catalog.resolveSupplierDocument(
      document.supplierTaxId,
      document.items.map(({ supplierCode }) => supplierCode),
    );
    const newMappings = document.items.flatMap((item, index) => {
      const itemResolution = resolution.resolutions[index];
      return !item.internalProductMapping && itemResolution?.status === "MATCHED"
        ? [
            {
              documentItemId: item.id,
              organizationId: context.organizationId,
              productPresentationId: itemResolution.mapping.product.presentationId,
            },
          ]
        : [];
    });
    const mappedCount =
      document.items.filter(({ internalProductMapping }) => internalProductMapping).length +
      newMappings.length;
    const nextStatus =
      resolution.supplierStatus !== "FOUND"
        ? FiscalDocumentStatus.PENDING_SUPPLIER
        : mappedCount === document.items.length
          ? FiscalDocumentStatus.READY_FOR_REVIEW
          : FiscalDocumentStatus.PENDING_MAPPING;

    if (newMappings.length > 0 || nextStatus !== document.status) {
      await this.database.value.$transaction(async (transaction) => {
        if (newMappings.length > 0) {
          await transaction.inboundFiscalDocumentItemMapping.createMany({
            data: newMappings,
            skipDuplicates: true,
          });
        }
        await transaction.inboundFiscalDocument.update({
          data: { status: nextStatus },
          where: { id_organizationId: { id: documentId, organizationId: context.organizationId } },
        });
        await transaction.auditEvent.create({
          data: {
            action: "fiscal-intake.nfe.resolved",
            actorUserId: context.userId,
            correlationId: context.correlationId,
            entityId: documentId,
            entityType: "inbound_fiscal_document",
            metadata: { mappedItems: newMappings.length, status: nextStatus },
            organizationId: context.organizationId,
            requestId: context.requestId,
          },
        });
      });
    }
    return this.loadDocument(documentId);
  }

  private async findDocumentReplay(accessKey: string, hashSha256: string): Promise<string | null> {
    const { organizationId } = this.requestContext.getAuthenticated();
    const existing = await this.database.value.inboundFiscalDocument.findUnique({
      include: { ingestions: { select: { hashSha256: true } } },
      where: { organizationId_accessKey: { accessKey, organizationId } },
    });
    if (!existing) return null;
    if (!existing.ingestions.some((ingestion) => ingestion.hashSha256 === hashSha256)) {
      throw new ConflictException("Access key already exists with different XML content");
    }
    return existing.id;
  }

  private async loadDocument(documentId: string): Promise<NfePersistentIntakeDto> {
    const { organizationId } = this.requestContext.getAuthenticated();
    const document = await this.database.value.inboundFiscalDocument.findUnique({
      include: {
        ingestions: { orderBy: { ingestedAt: "asc" } },
        items: {
          include: {
            internalProductMapping: {
              include: {
                productPresentation: { include: { product: true, unitOfMeasure: true } },
              },
            },
          },
          orderBy: { itemNumber: "asc" },
        },
      },
      where: { id_organizationId: { id: documentId, organizationId } },
    });
    if (!document || !document.ingestions[0]) throw new NotFoundException();

    const supplierResolution = await this.catalog.resolveSupplierDocument(
      document.supplierTaxId,
      document.items.map(({ supplierCode }) => supplierCode),
    );
    const supplierMissing = supplierResolution.supplierStatus !== "FOUND";
    const summary = { matched: 0, supplierNotFound: 0, unmapped: 0 };
    const items = document.items.map((item) => {
      const snapshot = item.internalProductMapping?.productPresentation;
      const resolution = supplierMissing
        ? ({ status: "SUPPLIER_NOT_FOUND" } as const)
        : snapshot
          ? ({ status: "MATCHED", product: productResponse(snapshot) } as const)
          : ({ status: "UNMAPPED" } as const);
      if (resolution.status === "MATCHED") summary.matched += 1;
      else if (resolution.status === "SUPPLIER_NOT_FOUND") summary.supplierNotFound += 1;
      else summary.unmapped += 1;

      return {
        ...(item.cest ? { cest: item.cest } : {}),
        cfop: item.cfop,
        commercialQuantity: item.commercialQuantity.toString(),
        commercialUnit: item.commercialUnit,
        commercialUnitValue: item.commercialUnitValue.toString(),
        description: item.description,
        ...(item.gtin ? { gtin: item.gtin } : {}),
        id: item.id,
        itemNumber: item.itemNumber,
        ncm: item.ncm,
        resolution,
        supplierCode: item.supplierCode,
        taxableQuantity: item.taxableQuantity.toString(),
        taxableUnit: item.taxableUnit,
        taxableUnitValue: item.taxableUnitValue.toString(),
        totalValue: item.totalValue.toString(),
      };
    });
    const ingestion = document.ingestions[0];
    return {
      accessKey: document.accessKey,
      documentId: document.id,
      documentNumber: document.documentNumber,
      documentTotal: document.documentTotal.toString(),
      hashSha256: ingestion.hashSha256,
      ingestionId: ingestion.id,
      issuedAt: document.issuedAt.toISOString(),
      items,
      natureOfOperation: document.natureOfOperation,
      ...(document.protocol ? { protocol: document.protocol } : {}),
      recipientTaxId: document.recipientTaxId,
      schemaVersion: document.schemaVersion,
      series: document.series,
      status: document.status,
      summary,
      supplier: {
        name: document.supplierName,
        ...(supplierResolution.supplierId ? { partnerId: supplierResolution.supplierId } : {}),
        resolution: supplierResolution.supplierStatus,
        taxId: document.supplierTaxId,
      },
    };
  }
}

function productResponse(presentation: {
  code: string;
  id: string;
  name: string;
  product: { id: string; shortDescription: string; sku: string };
  unitOfMeasure: { code: string; decimalScale: number; id: string; name: string };
}): MappedProductDto {
  return {
    presentationCode: presentation.code,
    presentationId: presentation.id,
    presentationName: presentation.name,
    productId: presentation.product.id,
    shortDescription: presentation.product.shortDescription,
    sku: presentation.product.sku,
    unit: {
      code: presentation.unitOfMeasure.code,
      decimalScale: presentation.unitOfMeasure.decimalScale,
      id: presentation.unitOfMeasure.id,
      name: presentation.unitOfMeasure.name,
    },
  };
}
