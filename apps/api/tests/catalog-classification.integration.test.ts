import { randomUUID } from "node:crypto";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { createDatabaseClient, type DatabaseClient } from "@sistema-erp/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApplication } from "../src/bootstrap.js";
import { hashPassword } from "../src/identity/password.js";

type Fixture = {
  memberToken: string;
  organizationAId: string;
  organizationBId: string;
  ownerAToken: string;
  ownerBToken: string;
  userIds: string[];
};

type SessionResponse = { token: string };
type CategoryResponse = {
  category: { code: string; depth: number; id: string; name: string; path: string[] };
  replayed: boolean;
};
type CategoryListResponse = {
  items: { active: boolean; code: string; depth: number; id: string; path: string[] }[];
};
type BrandResponse = { brand: { code: string; id: string; name: string }; replayed: boolean };
type BrandListResponse = { items: { code: string; id: string }[]; total: number };
type ProductResponse = { product: { id: string; sku: string }; replayed: boolean };
type ProductDetailResponse = {
  product: {
    brand?: { code: string; name: string };
    category?: { code: string; path: string[] };
    id: string;
    sku: string;
  };
};
type ProductListResponse = {
  items: { category?: { code: string }; id: string; sku: string }[];
  total: number;
};

describe("catalog classification", () => {
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
    await database.productBrand.deleteMany({ where: { organizationId: { in: organizationIds } } });
    // Filhos antes dos pais: a FK da taxonomia é RESTRICT.
    await database.productCategory.deleteMany({
      where: { organizationId: { in: organizationIds }, parentId: { not: null } },
    });
    await database.productCategory.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
    await database.unitOfMeasure.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await database.idempotencyRecord.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
    await database.session.deleteMany({ where: { userId: { in: fixture.userIds } } });
    await database.membership.deleteMany({ where: { userId: { in: fixture.userIds } } });
    await database.organization.deleteMany({ where: { id: { in: organizationIds } } });
    await database.user.deleteMany({ where: { id: { in: fixture.userIds } } });
    await database.$disconnect();
  });

  async function createFixture(): Promise<Fixture> {
    const suffix = randomUUID().slice(0, 8);
    const passwordHash = await hashPassword("valid_password");
    const [organizationA, organizationB] = await Promise.all([
      database.organization.create({
        data: { name: "Classification A", slug: `classification-a-${suffix}` },
      }),
      database.organization.create({
        data: { name: "Classification B", slug: `classification-b-${suffix}` },
      }),
    ]);
    const [ownerA, ownerB, member] = await Promise.all([
      database.user.create({
        data: { email: `class-owner-a-${suffix}@example.test`, name: "Owner A", passwordHash },
      }),
      database.user.create({
        data: { email: `class-owner-b-${suffix}@example.test`, name: "Owner B", passwordHash },
      }),
      database.user.create({
        data: { email: `class-member-${suffix}@example.test`, name: "Member", passwordHash },
      }),
    ]);

    await database.membership.createMany({
      data: [
        { organizationId: organizationA.id, role: "OWNER", userId: ownerA.id },
        { organizationId: organizationB.id, role: "OWNER", userId: ownerB.id },
        { organizationId: organizationA.id, role: "MEMBER", userId: member.id },
      ],
    });

    const logins = await Promise.all(
      [
        [ownerA.email, organizationA.slug],
        [ownerB.email, organizationB.slug],
        [member.email, organizationA.slug],
      ].map(([email, organizationSlug]) =>
        application.inject({
          method: "POST",
          payload: { email, organizationSlug, password: "valid_password" },
          url: "/api/v1/auth/sessions",
        }),
      ),
    );

    return {
      memberToken: logins[2]!.json<SessionResponse>().token,
      organizationAId: organizationA.id,
      organizationBId: organizationB.id,
      ownerAToken: logins[0]!.json<SessionResponse>().token,
      ownerBToken: logins[1]!.json<SessionResponse>().token,
      userIds: [ownerA.id, ownerB.id, member.id],
    };
  }

  function authenticated(token: string, idempotencyKey?: string) {
    return {
      authorization: `Bearer ${token}`,
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
    };
  }

  async function createCategory(
    key: string,
    payload: { code: string; name: string; parentId?: string },
    token = fixture.ownerAToken,
  ) {
    return application.inject({
      headers: authenticated(token, key),
      method: "POST",
      payload,
      url: "/api/v1/catalog/categories",
    });
  }

  it("builds a hierarchy and exposes the path from root to leaf", async () => {
    const root = await createCategory("cat-root", { code: "METAIS", name: "Metais" });
    const rootId = root.json<CategoryResponse>().category.id;
    const group = await createCategory("cat-group", {
      code: "CHAPAS",
      name: "Chapas",
      parentId: rootId,
    });
    const groupId = group.json<CategoryResponse>().category.id;
    const leaf = await createCategory("cat-leaf", {
      code: "GALV",
      name: "Galvanizada",
      parentId: groupId,
    });
    const replay = await createCategory("cat-root", { code: "METAIS", name: "Metais" });

    expect(root.statusCode).toBe(201);
    expect(root.json<CategoryResponse>().category).toMatchObject({ depth: 0, path: ["Metais"] });
    expect(group.json<CategoryResponse>().category).toMatchObject({
      depth: 1,
      path: ["Metais", "Chapas"],
    });
    expect(leaf.json<CategoryResponse>().category).toMatchObject({
      depth: 2,
      path: ["Metais", "Chapas", "Galvanizada"],
    });
    expect(replay.json<CategoryResponse>().replayed).toBe(true);
  });

  it("refuses duplicated codes, unknown parents and depth beyond the limit", async () => {
    const first = await createCategory("depth-root", { code: "PERFIS", name: "Perfis" });
    let parentId = first.json<CategoryResponse>().category.id;
    for (let level = 1; level <= 5; level += 1) {
      const child = await createCategory(`depth-${level}`, {
        code: `PERFIS-N${level}`,
        name: `Nível ${level}`,
        parentId,
      });
      expect(child.statusCode).toBe(201);
      parentId = child.json<CategoryResponse>().category.id;
    }

    const tooDeep = await createCategory("depth-overflow", {
      code: "PERFIS-N6",
      name: "Nível 6",
      parentId,
    });
    const duplicated = await createCategory("depth-duplicated", { code: "PERFIS", name: "Outro" });
    const unknownParent = await createCategory("depth-orphan", {
      code: "ORFAO",
      name: "Órfão",
      parentId: randomUUID(),
    });
    const crossTenantParent = await createCategory(
      "depth-cross",
      { code: "CROSS", name: "Cruzado", parentId: first.json<CategoryResponse>().category.id },
      fixture.ownerBToken,
    );

    expect(tooDeep.statusCode).toBe(409);
    expect(duplicated.statusCode).toBe(409);
    expect(unknownParent.statusCode).toBe(404);
    expect(crossTenantParent.statusCode).toBe(404);
  });

  it("renames a category and hides it without touching the code", async () => {
    const created = await createCategory("rename-base", { code: "FERRAM", name: "Ferramentas" });
    const categoryId = created.json<CategoryResponse>().category.id;
    const renamed = await application.inject({
      headers: authenticated(fixture.ownerAToken, "rename-apply"),
      method: "PATCH",
      payload: { active: false, name: "Ferramentaria" },
      url: `/api/v1/catalog/categories/${categoryId}`,
    });
    const codeAttempt = await application.inject({
      headers: authenticated(fixture.ownerAToken, "rename-code"),
      method: "PATCH",
      payload: { code: "OUTRO" },
      url: `/api/v1/catalog/categories/${categoryId}`,
    });
    const reparentAttempt = await application.inject({
      headers: authenticated(fixture.ownerAToken, "rename-parent"),
      method: "PATCH",
      payload: { parentId: randomUUID() },
      url: `/api/v1/catalog/categories/${categoryId}`,
    });

    expect(renamed.statusCode).toBe(200);
    expect(renamed.json<CategoryResponse>().category).toMatchObject({
      code: "FERRAM",
      name: "Ferramentaria",
    });
    expect(codeAttempt.statusCode).toBe(400);
    expect(reparentAttempt.statusCode).toBe(400);
  });

  it("creates brands and lists them by search", async () => {
    const created = await application.inject({
      headers: authenticated(fixture.ownerAToken, "brand-create"),
      method: "POST",
      payload: { code: "acme", name: "Acme Metais" },
      url: "/api/v1/catalog/brands",
    });
    const listed = await application.inject({
      headers: authenticated(fixture.memberToken),
      method: "GET",
      url: "/api/v1/catalog/brands?search=acme",
    });
    const denied = await application.inject({
      headers: authenticated(fixture.memberToken, "brand-denied"),
      method: "POST",
      payload: { code: "OUTRA", name: "Outra" },
      url: "/api/v1/catalog/brands",
    });

    expect(created.statusCode).toBe(201);
    expect(created.json<BrandResponse>().brand.code).toBe("ACME");
    expect(listed.json<BrandListResponse>().total).toBe(1);
    expect(denied.statusCode).toBe(403);
  });

  it("links a product to the taxonomy and filters the list by the whole subtree", async () => {
    const root = await createCategory("link-root", { code: "LINK-RAIZ", name: "Raiz" });
    const rootId = root.json<CategoryResponse>().category.id;
    const child = await createCategory("link-child", {
      code: "LINK-FILHO",
      name: "Filho",
      parentId: rootId,
    });
    const childId = child.json<CategoryResponse>().category.id;
    const brand = await application.inject({
      headers: authenticated(fixture.ownerAToken, "link-brand"),
      method: "POST",
      payload: { code: "LINKBRAND", name: "Marca do vínculo" },
      url: "/api/v1/catalog/brands",
    });

    const product = await application.inject({
      headers: authenticated(fixture.ownerAToken, "link-product"),
      method: "POST",
      payload: {
        baseUnit: { code: "KG", decimalScale: 4, name: "Quilograma" },
        brandId: brand.json<BrandResponse>().brand.id,
        categoryId: childId,
        shortDescription: "Produto classificado",
        sku: "SKU-LINK-1",
      },
      url: "/api/v1/catalog/products",
    });
    const detail = await application.inject({
      headers: authenticated(fixture.ownerAToken),
      method: "GET",
      url: `/api/v1/catalog/products/${product.json<ProductResponse>().product.id}`,
    });
    const bySubtree = await application.inject({
      headers: authenticated(fixture.ownerAToken),
      method: "GET",
      url: `/api/v1/catalog/products?categoryId=${rootId}`,
    });
    const byLeaf = await application.inject({
      headers: authenticated(fixture.ownerAToken),
      method: "GET",
      url: `/api/v1/catalog/products?categoryId=${childId}`,
    });
    const invalidFilter = await application.inject({
      headers: authenticated(fixture.ownerAToken),
      method: "GET",
      url: "/api/v1/catalog/products?categoryId=not-a-uuid",
    });

    expect(product.statusCode).toBe(201);
    expect(detail.json<ProductDetailResponse>().product).toMatchObject({
      brand: { code: "LINKBRAND" },
      category: { code: "LINK-FILHO", path: ["Raiz", "Filho"] },
    });
    // Filtrar pela raiz alcança o produto que está no filho.
    expect(bySubtree.json<ProductListResponse>().items.map((item) => item.sku)).toContain(
      "SKU-LINK-1",
    );
    expect(byLeaf.json<ProductListResponse>().total).toBe(1);
    expect(invalidFilter.statusCode).toBe(400);
  });

  it("clears the classification with null and refuses references from another tenant", async () => {
    const category = await createCategory("clear-category", { code: "CLEAR", name: "Limpar" });
    const product = await application.inject({
      headers: authenticated(fixture.ownerAToken, "clear-product"),
      method: "POST",
      payload: {
        baseUnit: { code: "KG", decimalScale: 4, name: "Quilograma" },
        categoryId: category.json<CategoryResponse>().category.id,
        shortDescription: "Produto para limpar",
        sku: "SKU-CLEAR-1",
      },
      url: "/api/v1/catalog/products",
    });
    const productId = product.json<ProductResponse>().product.id;

    const cleared = await application.inject({
      headers: authenticated(fixture.ownerAToken, "clear-apply"),
      method: "PATCH",
      payload: { categoryId: null },
      url: `/api/v1/catalog/products/${productId}`,
    });
    const unknownCategory = await application.inject({
      headers: authenticated(fixture.ownerAToken, "clear-unknown"),
      method: "PATCH",
      payload: { categoryId: randomUUID() },
      url: `/api/v1/catalog/products/${productId}`,
    });
    const invalidCategory = await application.inject({
      headers: authenticated(fixture.ownerAToken, "clear-invalid"),
      method: "PATCH",
      payload: { categoryId: "not-a-uuid" },
      url: `/api/v1/catalog/products/${productId}`,
    });

    expect(cleared.statusCode).toBe(200);
    expect(cleared.json<ProductDetailResponse>().product.category).toBeUndefined();
    expect(unknownCategory.statusCode).toBe(404);
    expect(invalidCategory.statusCode).toBe(400);
  });

  it("keeps the taxonomy isolated per tenant", async () => {
    await createCategory("iso-a", { code: "ISO-A", name: "Somente A" });
    const listedByB = await application.inject({
      headers: authenticated(fixture.ownerBToken),
      method: "GET",
      url: "/api/v1/catalog/categories",
    });

    expect(listedByB.json<CategoryListResponse>().items.some((item) => item.code === "ISO-A")).toBe(
      false,
    );
  });
});
