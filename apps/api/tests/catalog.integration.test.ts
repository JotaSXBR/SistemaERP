import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import {
  createDatabaseClient,
  PartnerRole,
  PartnerType,
  type DatabaseClient,
} from "@sistema-erp/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApplication } from "../src/bootstrap.js";
import { hashPassword } from "../src/identity/password.js";

const REFORM_NFE_XML = readFileSync(
  new URL("./fixtures/nfe-synthetic-reforma.xml", import.meta.url),
  "utf8",
);

const SYNTHETIC_NFE_XML = readFileSync(
  new URL("./fixtures/nfe-synthetic.xml", import.meta.url),
  "utf8",
);

type Fixture = {
  memberToken: string;
  organizationAId: string;
  organizationBId: string;
  ownerAToken: string;
  ownerBToken: string;
  userIds: string[];
};

type SessionResponse = { token: string };
type PartnerResponse = {
  partner: { id: string; taxId: string };
  replayed: boolean;
};
type ProductResponse = {
  product: { basePresentation: { id: string }; id: string; sku: string };
  replayed: boolean;
};
type MappingResponse = {
  mapping: { id: string; product: { productId: string }; supplierCode: string };
  replayed: boolean;
};
type PersistentIntakeResponse = { documentId: string };
type ProductDetailResponse = {
  product: {
    active: boolean;
    presentations: { code: string }[];
    shortDescription: string;
    sku: string;
    technicalDescription?: string;
  };
  replayed: boolean;
};

describe("catalog and supplier product mapping", () => {
  let application: NestFastifyApplication;
  let database: DatabaseClient;
  let fixture: Fixture;

  beforeAll(async () => {
    try {
      loadEnvFile(fileURLToPath(new URL("../../../.env", import.meta.url)));
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
        throw error;
      }
    }

    database = createDatabaseClient();
    application = await createApplication({ logger: false });
    await application.init();
    await application.getHttpAdapter().getInstance().ready();
    fixture = await createFixture();
  });

  afterAll(async () => {
    await application.close();
    await database.$executeRaw`ALTER TABLE "audit_events" DISABLE TRIGGER USER`;
    await database.auditEvent.deleteMany({
      where: { organizationId: { in: [fixture.organizationAId, fixture.organizationBId] } },
    });
    await database.$executeRaw`ALTER TABLE "audit_events" ENABLE TRIGGER USER`;
    await database.idempotencyRecord.deleteMany({
      where: { organizationId: { in: [fixture.organizationAId, fixture.organizationBId] } },
    });
    await database.inboundFiscalDocumentItemMapping.deleteMany({
      where: { organizationId: { in: [fixture.organizationAId, fixture.organizationBId] } },
    });
    await database.fiscalDocumentIngestion.deleteMany({
      where: { organizationId: { in: [fixture.organizationAId, fixture.organizationBId] } },
    });
    await database.inboundFiscalDocumentItemTax.deleteMany({
      where: { organizationId: { in: [fixture.organizationAId, fixture.organizationBId] } },
    });
    await database.inboundFiscalDocumentItem.deleteMany({
      where: { organizationId: { in: [fixture.organizationAId, fixture.organizationBId] } },
    });
    await database.inboundFiscalDocument.deleteMany({
      where: { organizationId: { in: [fixture.organizationAId, fixture.organizationBId] } },
    });
    await database.supplierProductMapping.deleteMany({
      where: { organizationId: { in: [fixture.organizationAId, fixture.organizationBId] } },
    });
    await database.productPresentation.deleteMany({
      where: { organizationId: { in: [fixture.organizationAId, fixture.organizationBId] } },
    });
    await database.product.deleteMany({
      where: { organizationId: { in: [fixture.organizationAId, fixture.organizationBId] } },
    });
    await database.unitOfMeasure.deleteMany({
      where: { organizationId: { in: [fixture.organizationAId, fixture.organizationBId] } },
    });
    await database.partner.deleteMany({
      where: { organizationId: { in: [fixture.organizationAId, fixture.organizationBId] } },
    });
    await database.session.deleteMany({ where: { userId: { in: fixture.userIds } } });
    await database.membership.deleteMany({
      where: { organizationId: { in: [fixture.organizationAId, fixture.organizationBId] } },
    });
    await database.organization.deleteMany({
      where: { id: { in: [fixture.organizationAId, fixture.organizationBId] } },
    });
    await database.user.deleteMany({ where: { id: { in: fixture.userIds } } });
    await database.$disconnect();
  });

  async function login(email: string, organizationSlug: string) {
    return application.inject({
      method: "POST",
      payload: { email, organizationSlug, password: "valid_password" },
      url: "/api/v1/auth/sessions",
    });
  }

  async function createFixture(): Promise<Fixture> {
    const suffix = randomUUID().slice(0, 8);
    const passwordHash = await hashPassword("valid_password");
    const [organizationA, organizationB] = await Promise.all([
      database.organization.create({
        data: {
          fiscalTaxId: "22222222222222",
          name: "Catalog Tenant A",
          slug: `catalog-a-${suffix}`,
        },
      }),
      database.organization.create({
        data: {
          fiscalTaxId: "33333333333333",
          name: "Catalog Tenant B",
          slug: `catalog-b-${suffix}`,
        },
      }),
    ]);
    const [ownerA, ownerB, member] = await Promise.all([
      database.user.create({
        data: { email: `catalog-owner-a-${suffix}@example.test`, name: "Owner A", passwordHash },
      }),
      database.user.create({
        data: { email: `catalog-owner-b-${suffix}@example.test`, name: "Owner B", passwordHash },
      }),
      database.user.create({
        data: { email: `catalog-member-${suffix}@example.test`, name: "Member", passwordHash },
      }),
    ]);

    await database.membership.createMany({
      data: [
        { organizationId: organizationA.id, role: "OWNER", userId: ownerA.id },
        { organizationId: organizationB.id, role: "OWNER", userId: ownerB.id },
        { organizationId: organizationA.id, role: "MEMBER", userId: member.id },
      ],
    });

    const [ownerALogin, ownerBLogin, memberLogin] = await Promise.all([
      login(ownerA.email, organizationA.slug),
      login(ownerB.email, organizationB.slug),
      login(member.email, organizationA.slug),
    ]);

    return {
      memberToken: memberLogin.json<SessionResponse>().token,
      organizationAId: organizationA.id,
      organizationBId: organizationB.id,
      ownerAToken: ownerALogin.json<SessionResponse>().token,
      ownerBToken: ownerBLogin.json<SessionResponse>().token,
      userIds: [ownerA.id, ownerB.id, member.id],
    };
  }

  function authenticated(token: string, idempotencyKey?: string) {
    return {
      authorization: `Bearer ${token}`,
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
    };
  }

  async function createSupplier(token: string, key: string, taxId = "AB.12C.D34/EF56-GH") {
    return application.inject({
      headers: authenticated(token, key),
      method: "POST",
      payload: {
        legalName: "Fornecedor sintético",
        roles: [PartnerRole.SUPPLIER],
        taxId,
        type: PartnerType.ORGANIZATION,
      },
      url: "/api/v1/partners",
    });
  }

  async function createProduct(token: string, key: string, sku = "SKU-SYNTHETIC-1") {
    return application.inject({
      headers: authenticated(token, key),
      method: "POST",
      payload: {
        baseUnit: { code: "KG", decimalScale: 4, name: "Quilograma" },
        shortDescription: "Produto sintético",
        sku,
      },
      url: "/api/v1/catalog/products",
    });
  }

  it("creates and replays an alphanumeric supplier without accepting organizationId", async () => {
    const first = await createSupplier(fixture.ownerAToken, "supplier-create-a");
    const replay = await createSupplier(fixture.ownerAToken, "supplier-create-a");
    const tenantAttempt = await application.inject({
      headers: authenticated(fixture.ownerAToken, "supplier-tenant-attempt"),
      method: "POST",
      payload: {
        legalName: "Fornecedor inválido",
        organizationId: fixture.organizationBId,
        roles: [PartnerRole.SUPPLIER],
        taxId: "11111111111111",
        type: PartnerType.ORGANIZATION,
      },
      url: "/api/v1/partners",
    });

    expect(first.statusCode).toBe(201);
    expect(first.json<PartnerResponse>()).toMatchObject({
      partner: { taxId: "AB12CD34EF56GH" },
      replayed: false,
    });
    expect(replay.statusCode).toBe(201);
    expect(replay.json<PartnerResponse>()).toMatchObject({ replayed: true });
    expect(tenantAttempt.statusCode).toBe(400);
  });

  it("creates a product with an exact decimal base presentation and enforces RBAC", async () => {
    const denied = await createProduct(fixture.memberToken, "product-member");
    const first = await createProduct(fixture.ownerAToken, "product-create-a");
    const replay = await createProduct(fixture.ownerAToken, "product-create-a");

    expect(denied.statusCode).toBe(403);
    expect(first.statusCode).toBe(201);
    expect(first.json<ProductResponse>()).toMatchObject({
      product: { sku: "SKU-SYNTHETIC-1" },
      replayed: false,
    });
    expect(replay.json<ProductResponse>()).toMatchObject({ replayed: true });

    const presentationId = first.json<ProductResponse>().product.basePresentation.id;
    const presentation = await database.productPresentation.findUniqueOrThrow({
      where: { id: presentationId },
    });
    expect(presentation.conversionFactor?.toString()).toBe("1");
  });

  it("maps supplier code deterministically and resolves it for authenticated members", async () => {
    const supplier = await createSupplier(
      fixture.ownerAToken,
      "mapping-supplier",
      "33333333333333",
    );
    const product = await createProduct(fixture.ownerAToken, "mapping-product", "SKU-MAPPING");
    const request = {
      headers: authenticated(fixture.ownerAToken, "mapping-create"),
      method: "POST" as const,
      payload: {
        productPresentationId: product.json<ProductResponse>().product.basePresentation.id,
        supplierCode: " ext-0001 ",
        supplierId: supplier.json<PartnerResponse>().partner.id,
      },
      url: "/api/v1/catalog/supplier-mappings",
    };
    const first = await application.inject(request);
    const replay = await application.inject(request);
    const resolved = await application.inject({
      headers: authenticated(fixture.memberToken),
      method: "POST",
      payload: { supplierCode: "EXT-0001", supplierTaxId: "33333333333333" },
      url: "/api/v1/catalog/supplier-mappings/resolve",
    });
    const unmapped = await application.inject({
      headers: authenticated(fixture.memberToken),
      method: "POST",
      payload: { supplierCode: "UNKNOWN", supplierTaxId: "33333333333333" },
      url: "/api/v1/catalog/supplier-mappings/resolve",
    });

    expect(first.statusCode).toBe(201);
    expect(first.json<MappingResponse>()).toMatchObject({
      mapping: {
        product: { productId: product.json<ProductResponse>().product.id },
        supplierCode: "ext-0001",
      },
      replayed: false,
    });
    expect(replay.json<MappingResponse>()).toMatchObject({ replayed: true });
    expect(resolved.statusCode).toBe(200);
    expect(resolved.json()).toMatchObject({ status: "MATCHED" });
    expect(unmapped.json()).toEqual({ status: "UNMAPPED" });
  });

  it("rejects cross-tenant mappings and keeps audit events in the authenticated tenant", async () => {
    const supplierA = await createSupplier(
      fixture.ownerAToken,
      "cross-supplier-a",
      "44444444444444",
    );
    const productB = await createProduct(fixture.ownerBToken, "cross-product-b", "SKU-TENANT-B");
    const response = await application.inject({
      headers: authenticated(fixture.ownerAToken, "cross-mapping"),
      method: "POST",
      payload: {
        productPresentationId: productB.json<ProductResponse>().product.basePresentation.id,
        supplierCode: "CROSS-1",
        supplierId: supplierA.json<PartnerResponse>().partner.id,
      },
      url: "/api/v1/catalog/supplier-mappings",
    });

    expect(response.statusCode).toBe(404);
    expect(
      await database.auditEvent.count({
        where: {
          action: { in: ["partners.created", "catalog.products.created"] },
          organizationId: fixture.organizationAId,
        },
      }),
    ).toBeGreaterThan(0);
    expect(
      await database.supplierProductMapping.count({
        where: {
          organizationId: fixture.organizationAId,
          productPresentationId: productB.json<ProductResponse>().product.basePresentation.id,
        },
      }),
    ).toBe(0);
  });

  it("previews an XML using only mappings from the authenticated tenant", async () => {
    const supplierA = await createSupplier(
      fixture.ownerAToken,
      "preview-supplier-a",
      "11111111111111",
    );
    const supplierB = await createSupplier(
      fixture.ownerBToken,
      "preview-supplier-b",
      "11111111111111",
    );
    const productA = await createProduct(fixture.ownerAToken, "preview-product-a", "SKU-PREVIEW-A");
    const productB = await createProduct(fixture.ownerBToken, "preview-product-b", "SKU-PREVIEW-B");
    const mappingA = await application.inject({
      headers: authenticated(fixture.ownerAToken, "preview-mapping-a"),
      method: "POST",
      payload: {
        productPresentationId: productA.json<ProductResponse>().product.basePresentation.id,
        supplierCode: "000123",
        supplierId: supplierA.json<PartnerResponse>().partner.id,
      },
      url: "/api/v1/catalog/supplier-mappings",
    });
    const mappingB = await application.inject({
      headers: authenticated(fixture.ownerBToken, "preview-mapping-b"),
      method: "POST",
      payload: {
        productPresentationId: productB.json<ProductResponse>().product.basePresentation.id,
        supplierCode: "000123",
        supplierId: supplierB.json<PartnerResponse>().partner.id,
      },
      url: "/api/v1/catalog/supplier-mappings",
    });
    const response = await application.inject({
      headers: { ...authenticated(fixture.memberToken), "content-type": "application/xml" },
      method: "POST",
      payload: SYNTHETIC_NFE_XML,
      url: "/api/v1/fiscal-intake/nfe/previews",
    });

    expect(mappingA.statusCode).toBe(201);
    expect(mappingB.statusCode).toBe(201);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      items: [
        {
          commercialQuantity: "0.1000",
          resolution: {
            mapping: { product: { productId: productA.json<ProductResponse>().product.id } },
            status: "MATCHED",
          },
          supplierCode: "000123",
        },
      ],
      summary: { matched: 1, supplierNotFound: 0, unmapped: 0 },
      validation: { issues: [], status: "PASSED" },
    });
  });

  it("persists, replays, and resolves a guided NF-e ingestion", async () => {
    const xml = SYNTHETIC_NFE_XML.replace(
      "11111111111111111111111111111111111111111111",
      "55555555555555555555555555555555555555555555",
    ).replace("<CNPJ>11111111111111</CNPJ>", "<CNPJ>99999999999999</CNPJ>");
    const customer = await application.inject({
      headers: authenticated(fixture.ownerAToken, "guided-customer"),
      method: "POST",
      payload: {
        legalName: "Parceiro sintético",
        roles: [PartnerRole.CUSTOMER],
        taxId: "99999999999999",
        type: PartnerType.ORGANIZATION,
      },
      url: "/api/v1/partners",
    });
    const ingestRequest = {
      headers: {
        ...authenticated(fixture.ownerAToken, "guided-ingestion"),
        "content-type": "application/xml",
      },
      method: "POST" as const,
      payload: xml,
      url: "/api/v1/fiscal-intake/nfe/ingestions",
    };
    const first = await application.inject(ingestRequest);
    const replay = await application.inject(ingestRequest);
    const reusedKey = await application.inject({
      ...ingestRequest,
      payload: xml.replace("PERFIL METALICO SINTETICO", "CONTEUDO DIVERGENTE"),
    });
    const divergentDocument = await application.inject({
      ...ingestRequest,
      headers: {
        ...authenticated(fixture.ownerAToken, "guided-divergent-document"),
        "content-type": "application/xml",
      },
      payload: xml.replace("PERFIL METALICO SINTETICO", "CONTEUDO DIVERGENTE"),
    });
    const denied = await application.inject({
      ...ingestRequest,
      headers: {
        ...authenticated(fixture.memberToken, "guided-member"),
        "content-type": "application/xml",
      },
    });

    expect(first.statusCode).toBe(201);
    expect(first.json()).toMatchObject({
      replayed: false,
      status: "PENDING_SUPPLIER",
      supplier: {
        partnerId: customer.json<PartnerResponse>().partner.id,
        resolution: "MISSING_SUPPLIER_ROLE",
      },
      summary: { matched: 0, supplierNotFound: 1, unmapped: 0 },
      validation: { issues: [], status: "PASSED" },
    });
    expect(replay.json()).toMatchObject({
      documentId: first.json<PersistentIntakeResponse>().documentId,
      replayed: true,
    });
    expect(reusedKey.statusCode).toBe(409);
    expect(divergentDocument.statusCode).toBe(409);
    expect(denied.statusCode).toBe(403);

    const partnerUpdate = await application.inject({
      headers: authenticated(fixture.ownerAToken, "guided-supplier-role"),
      method: "PATCH",
      payload: { active: true, roles: [PartnerRole.CUSTOMER, PartnerRole.SUPPLIER] },
      url: `/api/v1/partners/${customer.json<PartnerResponse>().partner.id}`,
    });
    const afterSupplier = await application.inject({
      headers: authenticated(fixture.ownerAToken),
      method: "POST",
      url: `/api/v1/fiscal-intake/nfe/documents/${first.json<PersistentIntakeResponse>().documentId}/resolve`,
    });
    const product = await createProduct(fixture.ownerAToken, "guided-product", "SKU-GUIDED-INTAKE");
    await application.inject({
      headers: authenticated(fixture.ownerAToken, "guided-mapping"),
      method: "POST",
      payload: {
        productPresentationId: product.json<ProductResponse>().product.basePresentation.id,
        supplierCode: "000123",
        supplierId: customer.json<PartnerResponse>().partner.id,
      },
      url: "/api/v1/catalog/supplier-mappings",
    });
    const ready = await application.inject({
      headers: authenticated(fixture.ownerAToken),
      method: "POST",
      url: `/api/v1/fiscal-intake/nfe/documents/${first.json<PersistentIntakeResponse>().documentId}/resolve`,
    });
    const inbox = await application.inject({
      headers: authenticated(fixture.ownerAToken),
      method: "GET",
      url: "/api/v1/fiscal-intake/nfe/documents?limit=10&offset=0",
    });
    const detail = await application.inject({
      headers: authenticated(fixture.ownerAToken),
      method: "GET",
      url: `/api/v1/fiscal-intake/nfe/documents/${first.json<PersistentIntakeResponse>().documentId}`,
    });
    const otherTenantDetail = await application.inject({
      headers: authenticated(fixture.ownerBToken),
      method: "GET",
      url: `/api/v1/fiscal-intake/nfe/documents/${first.json<PersistentIntakeResponse>().documentId}`,
    });

    expect(partnerUpdate.statusCode).toBe(200);
    expect(afterSupplier.json()).toMatchObject({
      status: "PENDING_MAPPING",
      supplier: { resolution: "FOUND" },
      summary: { matched: 0, supplierNotFound: 0, unmapped: 1 },
    });
    expect(ready.json()).toMatchObject({
      status: "READY_FOR_REVIEW",
      summary: { matched: 1, supplierNotFound: 0, unmapped: 0 },
    });
    expect(inbox.json()).toMatchObject({
      items: [
        {
          documentId: first.json<PersistentIntakeResponse>().documentId,
          itemCount: 1,
          status: "READY_FOR_REVIEW",
        },
      ],
    });
    expect(detail.json()).toMatchObject({
      documentId: first.json<PersistentIntakeResponse>().documentId,
      status: "READY_FOR_REVIEW",
    });
    expect(otherTenantDetail.statusCode).toBe(404);
    expect(
      await database.inboundFiscalDocument.count({
        where: { accessKey: "5".repeat(44), organizationId: fixture.organizationAId },
      }),
    ).toBe(1);
  });

  it("preserves the declared tax group of each item and exposes it on the document", async () => {
    const response = await application.inject({
      headers: {
        ...authenticated(fixture.ownerAToken, "tax-snapshot-ingest"),
        "content-type": "application/xml",
      },
      method: "POST",
      payload: REFORM_NFE_XML,
      url: "/api/v1/fiscal-intake/nfe/ingestions",
    });
    const documentId = response.json<PersistentIntakeResponse>().documentId;
    const detail = await application.inject({
      headers: authenticated(fixture.ownerAToken),
      method: "GET",
      url: `/api/v1/fiscal-intake/nfe/documents/${documentId}`,
    });

    expect(response.statusCode).toBe(201);
    const [item] = detail.json<{ items: { tax?: Record<string, string> }[] }>().items;
    // Decimal normaliza zeros a direita no retorno: 11.1100 volta como 11.11. O valor numerico e
    // identico e o XML original preservado no object storage segue sendo a fonte verbatim da
    // escala declarada pelo emitente.
    expect(item?.tax).toMatchObject({
      cbsValue: "11.11",
      ibsCbsClassification: "000001",
      ibsCbsCst: "000",
      icmsBenefitCode: "SP000001",
      icmsCst: "20",
      icmsValue: "98.76",
      origin: "0",
    });
    // Nenhum campo ausente vira zero: sem CSOSN declarado, a chave nao existe na resposta.
    expect(item?.tax && "icmsCsosn" in item.tax).toBe(false);
    expect(
      await database.inboundFiscalDocumentItemTax.count({
        where: { documentItem: { documentId }, organizationId: fixture.organizationAId },
      }),
    ).toBe(1);
  });

  it("persists a recipient mismatch without advancing catalog snapshots", async () => {
    const xml = SYNTHETIC_NFE_XML.replace(
      "11111111111111111111111111111111111111111111",
      "66666666666666666666666666666666666666666666",
    );
    const response = await application.inject({
      headers: {
        ...authenticated(fixture.ownerBToken, "recipient-mismatch"),
        "content-type": "application/xml",
      },
      method: "POST",
      payload: xml,
      url: "/api/v1/fiscal-intake/nfe/ingestions",
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      status: "VALIDATION_FAILED",
      validation: { issues: ["RECIPIENT_TAX_ID_MISMATCH"], status: "FAILED" },
    });
    const documentId = response.json<PersistentIntakeResponse>().documentId;
    expect(
      await database.inboundFiscalDocumentItemMapping.count({
        where: { documentItem: { documentId }, organizationId: fixture.organizationBId },
      }),
    ).toBe(0);

    const identity = await application.inject({
      headers: authenticated(fixture.ownerBToken, "recipient-mismatch-correction"),
      method: "PATCH",
      payload: { taxId: "22222222222222" },
      url: "/api/v1/organizations/current/fiscal-identity",
    });
    const resolved = await application.inject({
      headers: authenticated(fixture.ownerBToken),
      method: "POST",
      url: `/api/v1/fiscal-intake/nfe/documents/${documentId}/resolve`,
    });

    expect(identity.statusCode).toBe(200);
    expect(resolved.json()).toMatchObject({
      status: "READY_FOR_REVIEW",
      validation: { issues: [], status: "PASSED" },
    });
    expect(
      await database.inboundFiscalDocumentItemMapping.count({
        where: { documentItem: { documentId }, organizationId: fixture.organizationBId },
      }),
    ).toBe(1);
  });

  it("rejects invalid, unsupported, and oversized XML requests without leaking content", async () => {
    const invalid = await application.inject({
      headers: { ...authenticated(fixture.memberToken), "content-type": "application/xml" },
      method: "POST",
      payload: "<invalid>",
      url: "/api/v1/fiscal-intake/nfe/previews",
    });
    const unsupported = await application.inject({
      headers: {
        ...authenticated(fixture.memberToken),
        "content-type": "application/octet-stream",
      },
      method: "POST",
      payload: "sensitive-content",
      url: "/api/v1/fiscal-intake/nfe/previews",
    });
    const oversized = await application.inject({
      headers: { ...authenticated(fixture.memberToken), "content-type": "application/xml" },
      method: "POST",
      payload: "x".repeat(5 * 1024 * 1024 + 1),
      url: "/api/v1/fiscal-intake/nfe/previews",
    });

    expect(invalid.statusCode).toBe(400);
    expect(invalid.body).not.toContain("invalid");
    expect(unsupported.statusCode).toBe(415);
    expect(unsupported.json()).toMatchObject({
      error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Tipo de conteúdo não suportado" },
    });
    expect(unsupported.body).not.toContain("sensitive-content");
    expect(oversized.statusCode).toBe(413);
    expect(oversized.json()).toMatchObject({ error: { code: "PAYLOAD_TOO_LARGE" } });
  });
  it("updates a product idempotently and keeps sku and base unit immutable", async () => {
    const created = await createProduct(fixture.ownerAToken, "product-update-base", "SKU-UPDATE-1");
    const productId = created.json<ProductResponse>().product.id;
    const update = {
      headers: authenticated(fixture.ownerAToken, "product-update-1"),
      method: "PATCH" as const,
      payload: {
        active: false,
        shortDescription: "  Produto sintético revisado  ",
        technicalDescription: "Ficha técnica sintética",
      },
      url: `/api/v1/catalog/products/${productId}`,
    };
    const first = await application.inject(update);
    const replay = await application.inject(update);
    const divergent = await application.inject({
      ...update,
      payload: { active: true },
    });
    const detail = await application.inject({
      headers: authenticated(fixture.ownerAToken),
      method: "GET",
      url: `/api/v1/catalog/products/${productId}`,
    });

    expect(first.statusCode).toBe(200);
    expect(first.json<ProductDetailResponse>()).toMatchObject({
      product: {
        active: false,
        shortDescription: "Produto sintético revisado",
        sku: "SKU-UPDATE-1",
        technicalDescription: "Ficha técnica sintética",
      },
      replayed: false,
    });
    expect(first.json<ProductDetailResponse>().product.presentations).toHaveLength(1);
    expect(replay.json<ProductDetailResponse>().replayed).toBe(true);
    expect(divergent.statusCode).toBe(409);
    expect(detail.json<ProductDetailResponse>().product).toMatchObject({
      active: false,
      shortDescription: "Produto sintético revisado",
      sku: "SKU-UPDATE-1",
    });
  });

  it("clears the technical description with an empty string", async () => {
    const created = await application.inject({
      headers: authenticated(fixture.ownerAToken, "product-update-clear-base"),
      method: "POST",
      payload: {
        baseUnit: { code: "KG", decimalScale: 4, name: "Quilograma" },
        shortDescription: "Produto com ficha",
        sku: "SKU-UPDATE-CLEAR",
        technicalDescription: "Ficha a remover",
      },
      url: "/api/v1/catalog/products",
    });
    const cleared = await application.inject({
      headers: authenticated(fixture.ownerAToken, "product-update-clear"),
      method: "PATCH",
      payload: { technicalDescription: "" },
      url: `/api/v1/catalog/products/${created.json<ProductResponse>().product.id}`,
    });

    expect(cleared.statusCode).toBe(200);
    expect(cleared.json<ProductDetailResponse>().product.technicalDescription).toBeUndefined();
  });

  it("rejects invalid product updates and tenant or role escalation", async () => {
    const created = await createProduct(
      fixture.ownerAToken,
      "product-update-guard-base",
      "SKU-UPDATE-GUARD",
    );
    const productId = created.json<ProductResponse>().product.id;
    const patch = (
      payload: Record<string, unknown>,
      key: string,
      token = fixture.ownerAToken,
      id = productId,
    ) =>
      application.inject({
        headers: authenticated(token, key),
        method: "PATCH",
        payload,
        url: `/api/v1/catalog/products/${id}`,
      });

    const empty = await patch({}, "product-update-empty");
    const blankDescription = await patch({ shortDescription: "   " }, "product-update-blank");
    const skuAttempt = await patch({ sku: "SKU-OTHER" }, "product-update-sku");
    const tenantAttempt = await patch(
      { active: false, organizationId: fixture.organizationBId },
      "product-update-tenant",
    );
    const missingKey = await application.inject({
      headers: authenticated(fixture.ownerAToken),
      method: "PATCH",
      payload: { active: false },
      url: `/api/v1/catalog/products/${productId}`,
    });
    const memberAttempt = await patch(
      { active: false },
      "product-update-member",
      fixture.memberToken,
    );
    const otherTenant = await patch(
      { active: false },
      "product-update-cross-tenant",
      fixture.ownerBToken,
    );
    const unknown = await patch(
      { active: false },
      "product-update-unknown",
      fixture.ownerAToken,
      randomUUID(),
    );

    expect(empty.statusCode).toBe(400);
    expect(blankDescription.statusCode).toBe(400);
    expect(skuAttempt.statusCode).toBe(400);
    expect(tenantAttempt.statusCode).toBe(400);
    expect(missingKey.statusCode).toBe(400);
    expect(memberAttempt.statusCode).toBe(403);
    expect(otherTenant.statusCode).toBe(404);
    expect(unknown.statusCode).toBe(404);
  });
});
