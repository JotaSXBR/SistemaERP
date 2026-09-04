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
  organizationId: string;
  ownerToken: string;
  userIds: string[];
};

type SessionResponse = { token: string };
type ProductResponse = { product: { id: string; sku: string }; replayed: boolean };
type ProductDetailResponse = {
  product: {
    geometry: Record<string, string | undefined>;
    id: string;
    sku: string;
  };
};

describe("catalog product geometry", () => {
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
    const organizationIds = [fixture.organizationId];
    await database.$executeRaw`ALTER TABLE "audit_events" DISABLE TRIGGER USER`;
    await database.auditEvent.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await database.$executeRaw`ALTER TABLE "audit_events" ENABLE TRIGGER USER`;
    await database.productPresentation.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
    await database.product.deleteMany({ where: { organizationId: { in: organizationIds } } });
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
    const organization = await database.organization.create({
      data: { name: "Geometry", slug: `geometry-${suffix}` },
    });
    const [owner, member] = await Promise.all([
      database.user.create({
        data: { email: `geo-owner-${suffix}@example.test`, name: "Owner", passwordHash },
      }),
      database.user.create({
        data: { email: `geo-member-${suffix}@example.test`, name: "Member", passwordHash },
      }),
    ]);

    await database.membership.createMany({
      data: [
        { organizationId: organization.id, role: "OWNER", userId: owner.id },
        { organizationId: organization.id, role: "MEMBER", userId: member.id },
      ],
    });

    const logins = await Promise.all(
      [owner.email, member.email].map((email) =>
        application.inject({
          method: "POST",
          payload: { email, organizationSlug: organization.slug, password: "valid_password" },
          url: "/api/v1/auth/sessions",
        }),
      ),
    );

    return {
      memberToken: logins[1]!.json<SessionResponse>().token,
      organizationId: organization.id,
      ownerToken: logins[0]!.json<SessionResponse>().token,
      userIds: [owner.id, member.id],
    };
  }

  function authenticated(token: string, idempotencyKey?: string) {
    return {
      authorization: `Bearer ${token}`,
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
    };
  }

  // O código da unidade é limitado a 16 caracteres, então um contador basta para mantê-los únicos.
  let unitSequence = 0;

  async function createProduct(key: string, sku: string) {
    unitSequence += 1;
    const created = await application.inject({
      headers: authenticated(fixture.ownerToken, key),
      method: "POST",
      payload: {
        baseUnit: { code: `KG-${unitSequence}`, decimalScale: 3, name: "Quilograma" },
        shortDescription: `Produto ${sku}`,
        sku,
      },
      url: "/api/v1/catalog/products",
    });

    if (created.statusCode !== 201) {
      throw new Error(`create ${created.statusCode}: ${created.body}`);
    }

    return created.json<ProductResponse>().product.id;
  }

  async function patchProduct(key: string, id: string, payload: Record<string, unknown>) {
    return application.inject({
      headers: authenticated(fixture.ownerToken, key),
      method: "PATCH",
      payload,
      url: `/api/v1/catalog/products/${id}`,
    });
  }

  async function findProduct(id: string) {
    return application.inject({
      headers: authenticated(fixture.ownerToken),
      method: "GET",
      url: `/api/v1/catalog/products/${id}`,
    });
  }

  it("records measurements and returns them as exact decimal strings", async () => {
    const productId = await createProduct("geo-create", "GEO-CHAPA");

    const updated = await patchProduct("geo-patch", productId, {
      geometry: {
        lengthMm: "6000",
        thicknessMm: "3.18",
        weightPerSquareMeterKg: "24.964",
        widthMm: "1200",
      },
    });

    expect(updated.statusCode).toBe(200);
    const geometry = updated.json<{ product: ProductDetailResponse["product"] }>().product.geometry;
    // A coluna é numeric(24, 10), então a escala volta completa; o número é o mesmo.
    expect(Number(geometry.thicknessMm)).toBe(3.18);
    expect(Number(geometry.widthMm)).toBe(1200);
    expect(Number(geometry.lengthMm)).toBe(6000);
    expect(Number(geometry.weightPerSquareMeterKg)).toBe(24.964);
    // O que não se aplica a uma chapa não aparece na resposta.
    expect(geometry.outerDiameterMm).toBeUndefined();
    expect(geometry.innerDiameterMm).toBeUndefined();
  });

  it("keeps measurements that the request left out and clears the ones sent as null", async () => {
    const productId = await createProduct("geo-partial-create", "GEO-TUBO");
    await patchProduct("geo-partial-first", productId, {
      geometry: { lengthMm: "6000", outerDiameterMm: "60.3", thicknessMm: "3.91" },
    });

    const updated = await patchProduct("geo-partial-second", productId, {
      geometry: { outerDiameterMm: null, thicknessMm: "5.16" },
    });

    expect(updated.statusCode).toBe(200);
    const geometry = updated.json<{ product: ProductDetailResponse["product"] }>().product.geometry;
    expect(Number(geometry.thicknessMm)).toBe(5.16);
    // Ausente do pedido: continua como estava.
    expect(Number(geometry.lengthMm)).toBe(6000);
    // Nulo explícito: a medida deixa de se aplicar.
    expect(geometry.outerDiameterMm).toBeUndefined();
  });

  it("persists the measurements so a later read returns them", async () => {
    const productId = await createProduct("geo-read-create", "GEO-BARRA");
    await patchProduct("geo-read-patch", productId, {
      geometry: { outerDiameterMm: "25.4", weightPerMeterKg: "3.973" },
    });

    const found = await findProduct(productId);

    expect(found.statusCode).toBe(200);
    const geometry = found.json<ProductDetailResponse>().product.geometry;
    expect(Number(geometry.outerDiameterMm)).toBe(25.4);
    expect(Number(geometry.weightPerMeterKg)).toBe(3.973);
  });

  it("rejects zero, negative, non-numeric and unknown measurements", async () => {
    const productId = await createProduct("geo-invalid-create", "GEO-INVALIDO");

    // Zero é uma medida real, e a ADR-0010 proíbe usá-lo como "não se aplica" — para isso há null.
    const zero = await patchProduct("geo-invalid-zero", productId, {
      geometry: { thicknessMm: "0" },
    });
    expect(zero.statusCode).toBe(400);

    const negative = await patchProduct("geo-invalid-negative", productId, {
      geometry: { thicknessMm: "-3" },
    });
    expect(negative.statusCode).toBe(400);

    const text = await patchProduct("geo-invalid-text", productId, {
      geometry: { thicknessMm: '3,18"' },
    });
    expect(text.statusCode).toBe(400);

    // Número em JSON passaria por ponto flutuante; a medida entra em cálculo de preço.
    const numeric = await patchProduct("geo-invalid-number", productId, {
      geometry: { thicknessMm: 3.18 },
    });
    expect(numeric.statusCode).toBe(400);

    const unknown = await patchProduct("geo-invalid-field", productId, {
      geometry: { diameterMm: "25.4" },
    });
    expect(unknown.statusCode).toBe(400);

    const empty = await patchProduct("geo-invalid-empty", productId, { geometry: {} });
    expect(empty.statusCode).toBe(400);
  });

  it("keeps the measurements out of reach for a member", async () => {
    const productId = await createProduct("geo-role-create", "GEO-PAPEL");

    const forbidden = await application.inject({
      headers: authenticated(fixture.memberToken, "geo-role-patch"),
      method: "PATCH",
      payload: { geometry: { thicknessMm: "2" } },
      url: `/api/v1/catalog/products/${productId}`,
    });

    expect(forbidden.statusCode).toBe(403);
  });

  it("audits which measurements actually changed", async () => {
    const productId = await createProduct("geo-audit-create", "GEO-AUDIT");
    await patchProduct("geo-audit-first", productId, {
      geometry: { thicknessMm: "3.18", widthMm: "1200" },
    });

    // Reenviar o mesmo valor com outra escala não é mudança: a comparação é decimal, não textual.
    await patchProduct("geo-audit-second", productId, {
      geometry: { lengthMm: "6000", thicknessMm: "3.1800" },
    });

    const events = await database.auditEvent.findMany({
      orderBy: { occurredAt: "asc" },
      where: {
        action: "catalog.products.updated",
        entityId: productId,
        organizationId: fixture.organizationId,
      },
    });

    expect(events).toHaveLength(2);
    const first = events[0]!.metadata as { geometryChanged: string[] };
    expect(first.geometryChanged.sort()).toEqual(["thicknessMm", "widthMm"]);
    const second = events[1]!.metadata as { geometryChanged: string[] };
    expect(second.geometryChanged).toEqual(["lengthMm"]);
  });
});
