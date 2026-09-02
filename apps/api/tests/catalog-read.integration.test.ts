import { randomUUID } from "node:crypto";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import {
  createDatabaseClient,
  PartnerRole,
  PartnerType,
  ProductConversionMode,
  type DatabaseClient,
} from "@sistema-erp/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApplication } from "../src/bootstrap.js";
import { hashPassword } from "../src/identity/password.js";

type Fixture = {
  memberToken: string;
  organizationAId: string;
  organizationBId: string;
  ownerAToken: string;
  partnerBId: string;
  productBId: string;
  userIds: string[];
};

type SessionResponse = { token: string };
type PartnerListResponse = {
  items: { id: string; legalName: string; roles: PartnerRole[]; taxId: string }[];
  limit: number;
  offset: number;
  total: number;
};
type ProductListResponse = {
  items: { baseUnit: { code: string }; id: string; sku: string }[];
  limit: number;
  offset: number;
  total: number;
};

describe("partners and catalog read routes", () => {
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
    const organizationIds = [fixture.organizationAId, fixture.organizationBId];
    await database.$executeRaw`ALTER TABLE "audit_events" DISABLE TRIGGER USER`;
    await database.auditEvent.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await database.$executeRaw`ALTER TABLE "audit_events" ENABLE TRIGGER USER`;
    await database.productPresentation.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
    await database.product.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await database.unitOfMeasure.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await database.partner.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await database.session.deleteMany({ where: { userId: { in: fixture.userIds } } });
    await database.membership.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await database.organization.deleteMany({ where: { id: { in: organizationIds } } });
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

  async function seedProduct(organizationId: string, sku: string, shortDescription: string) {
    const unit = await database.unitOfMeasure.upsert({
      create: { code: "KG", decimalScale: 4, name: "Quilograma", organizationId },
      update: {},
      where: { organizationId_code: { code: "KG", organizationId } },
    });
    const product = await database.product.create({
      data: {
        baseUnitId: unit.id,
        organizationId,
        shortDescription,
        sku,
        technicalDescription: "Descrição técnica sintética",
      },
    });

    await database.productPresentation.create({
      data: {
        code: "BASE",
        conversionFactor: "1",
        conversionMode: ProductConversionMode.FIXED,
        name: "Apresentação base",
        organizationId,
        productId: product.id,
        unitOfMeasureId: unit.id,
      },
    });

    return product;
  }

  async function createFixture(): Promise<Fixture> {
    const suffix = randomUUID().slice(0, 8);
    const passwordHash = await hashPassword("valid_password");
    const [organizationA, organizationB] = await Promise.all([
      database.organization.create({
        data: { name: "Read Tenant A", slug: `read-a-${suffix}` },
      }),
      database.organization.create({
        data: { name: "Read Tenant B", slug: `read-b-${suffix}` },
      }),
    ]);
    const [ownerA, member] = await Promise.all([
      database.user.create({
        data: { email: `read-owner-a-${suffix}@example.test`, name: "Owner A", passwordHash },
      }),
      database.user.create({
        data: { email: `read-member-${suffix}@example.test`, name: "Member", passwordHash },
      }),
    ]);

    await database.membership.createMany({
      data: [
        { organizationId: organizationA.id, role: "OWNER", userId: ownerA.id },
        { organizationId: organizationA.id, role: "MEMBER", userId: member.id },
      ],
    });

    await database.partner.createMany({
      data: [
        {
          legalName: "Alfa Distribuidora",
          organizationId: organizationA.id,
          roles: [PartnerRole.SUPPLIER],
          taxId: "11111111111111",
          tradeName: "Alfa",
          type: PartnerType.ORGANIZATION,
        },
        {
          active: false,
          legalName: "Beta Comercial",
          organizationId: organizationA.id,
          roles: [PartnerRole.CUSTOMER],
          taxId: "22222222222222",
          type: PartnerType.ORGANIZATION,
        },
        {
          legalName: "Gama Serviços",
          organizationId: organizationA.id,
          roles: [PartnerRole.SUPPLIER, PartnerRole.CUSTOMER],
          taxId: "33333333333333",
          type: PartnerType.ORGANIZATION,
        },
      ],
    });
    const partnerB = await database.partner.create({
      data: {
        legalName: "Tenant B Distribuidora",
        organizationId: organizationB.id,
        roles: [PartnerRole.SUPPLIER],
        taxId: "44444444444444",
        type: PartnerType.ORGANIZATION,
      },
    });

    await seedProduct(organizationA.id, "SKU-A-1", "Aço inoxidável");
    await seedProduct(organizationA.id, "SKU-A-2", "Bobina de cobre");
    const productB = await seedProduct(organizationB.id, "SKU-B-1", "Produto do tenant B");

    const [ownerALogin, memberLogin] = await Promise.all([
      login(ownerA.email, organizationA.slug),
      login(member.email, organizationA.slug),
    ]);

    return {
      memberToken: memberLogin.json<SessionResponse>().token,
      organizationAId: organizationA.id,
      organizationBId: organizationB.id,
      ownerAToken: ownerALogin.json<SessionResponse>().token,
      partnerBId: partnerB.id,
      productBId: productB.id,
      userIds: [ownerA.id, member.id],
    };
  }

  function authenticated(token: string) {
    return { authorization: `Bearer ${token}` };
  }

  async function get(url: string, token = fixture.memberToken) {
    return application.inject({ headers: authenticated(token), method: "GET", url });
  }

  it("lists only partners of the authenticated tenant, ordered and paginated", async () => {
    const firstPage = await get("/api/v1/partners?limit=2");
    const secondPage = await get("/api/v1/partners?limit=2&offset=2");

    expect(firstPage.statusCode).toBe(200);
    const first = firstPage.json<PartnerListResponse>();
    expect(first.total).toBe(3);
    expect(first.limit).toBe(2);
    expect(first.offset).toBe(0);
    expect(first.items.map((partner) => partner.legalName)).toEqual([
      "Alfa Distribuidora",
      "Beta Comercial",
    ]);

    const second = secondPage.json<PartnerListResponse>();
    expect(second.items.map((partner) => partner.legalName)).toEqual(["Gama Serviços"]);
    expect(second.items.map((partner) => partner.id)).not.toContain(fixture.partnerBId);
  });

  it("filters partners by search, role and active", async () => {
    const bySearch = await get("/api/v1/partners?search=alfa");
    const byTaxId = await get("/api/v1/partners?search=33.333.333/3333-33");
    const byRole = await get(`/api/v1/partners?role=${PartnerRole.CUSTOMER}&active=false`);

    expect(bySearch.json<PartnerListResponse>().items.map((partner) => partner.legalName)).toEqual([
      "Alfa Distribuidora",
    ]);
    expect(byTaxId.json<PartnerListResponse>().items.map((partner) => partner.taxId)).toEqual([
      "33333333333333",
    ]);
    expect(byRole.json<PartnerListResponse>().items.map((partner) => partner.legalName)).toEqual([
      "Beta Comercial",
    ]);
  });

  it("reads a partner by id and hides partners from other tenants", async () => {
    const list = await get("/api/v1/partners?search=gama");
    const partnerId = list.json<PartnerListResponse>().items[0]?.id ?? "";
    const found = await get(`/api/v1/partners/${partnerId}`);
    const crossTenant = await get(`/api/v1/partners/${fixture.partnerBId}`);
    const malformed = await get("/api/v1/partners/not-a-uuid");

    expect(found.statusCode).toBe(200);
    expect(found.json()).toMatchObject({ partner: { legalName: "Gama Serviços" } });
    expect(crossTenant.statusCode).toBe(404);
    expect(malformed.statusCode).toBe(400);
  });

  it("lists and reads catalog products restricted to the authenticated tenant", async () => {
    const list = await get("/api/v1/catalog/products?limit=1");
    const bySku = await get("/api/v1/catalog/products?search=sku-a-2");
    const products = list.json<ProductListResponse>();

    expect(list.statusCode).toBe(200);
    expect(products.total).toBe(2);
    expect(products.items).toHaveLength(1);
    expect(products.items[0]).toMatchObject({ baseUnit: { code: "KG" }, sku: "SKU-A-1" });

    const productId = bySku.json<ProductListResponse>().items[0]?.id ?? "";
    const detail = await get(`/api/v1/catalog/products/${productId}`);
    const crossTenant = await get(`/api/v1/catalog/products/${fixture.productBId}`);

    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      product: {
        baseUnit: { code: "KG" },
        presentations: [{ code: "BASE", conversionFactor: "1" }],
        sku: "SKU-A-2",
        technicalDescription: "Descrição técnica sintética",
      },
    });
    expect(crossTenant.statusCode).toBe(404);
  });

  it("rejects invalid pagination and filter parameters", async () => {
    const responses = await Promise.all([
      get("/api/v1/partners?limit=0"),
      get("/api/v1/partners?limit=101"),
      get("/api/v1/partners?offset=-1"),
      get("/api/v1/partners?active=yes"),
      get("/api/v1/partners?role=UNKNOWN"),
      get("/api/v1/catalog/products?limit=abc"),
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([
      400, 400, 400, 400, 400, 400,
    ]);
  });

  it("requires an authenticated session and ignores a client supplied organizationId", async () => {
    const anonymous = await application.inject({ method: "GET", url: "/api/v1/partners" });
    const spoofed = await get(`/api/v1/partners?organizationId=${fixture.organizationBId}`);

    expect(anonymous.statusCode).toBe(401);
    expect(spoofed.statusCode).toBe(200);
    expect(spoofed.json<PartnerListResponse>().total).toBe(3);
  });
});
