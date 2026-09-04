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
type DefinitionResponse = {
  definition: { active: boolean; code: string; id: string; name: string; options: unknown[] };
  replayed: boolean;
};
type OptionResponse = {
  option: { active: boolean; code: string; id: string; name: string };
  replayed: boolean;
};
type DefinitionListResponse = {
  items: {
    active: boolean;
    code: string;
    id: string;
    options: { active: boolean; code: string; id: string }[];
  }[];
};
type ProductResponse = { product: { id: string; sku: string }; replayed: boolean };
type ProductDetailResponse = {
  product: {
    attributes: {
      definitionCode: string;
      definitionId: string;
      optionCode: string;
      optionId: string;
    }[];
    id: string;
    sku: string;
  };
};

describe("catalog attributes", () => {
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
    // A junção primeiro: eixos, opções e produtos são todos RESTRICT.
    await database.productAttribute.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
    await database.productAttributeOption.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
    await database.productAttributeDefinition.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
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
    const [organizationA, organizationB] = await Promise.all([
      database.organization.create({
        data: { name: "Attributes A", slug: `attributes-a-${suffix}` },
      }),
      database.organization.create({
        data: { name: "Attributes B", slug: `attributes-b-${suffix}` },
      }),
    ]);
    const [ownerA, ownerB, member] = await Promise.all([
      database.user.create({
        data: { email: `attr-owner-a-${suffix}@example.test`, name: "Owner A", passwordHash },
      }),
      database.user.create({
        data: { email: `attr-owner-b-${suffix}@example.test`, name: "Owner B", passwordHash },
      }),
      database.user.create({
        data: { email: `attr-member-${suffix}@example.test`, name: "Member", passwordHash },
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

  async function createDefinition(
    key: string,
    payload: { code: string; name: string },
    token = fixture.ownerAToken,
  ) {
    return application.inject({
      headers: authenticated(token, key),
      method: "POST",
      payload,
      url: "/api/v1/catalog/attribute-definitions",
    });
  }

  async function createOption(
    key: string,
    payload: { code: string; definitionId: string; name: string },
    token = fixture.ownerAToken,
  ) {
    return application.inject({
      headers: authenticated(token, key),
      method: "POST",
      payload,
      url: "/api/v1/catalog/attribute-options",
    });
  }

  async function createProduct(key: string, sku: string) {
    return application.inject({
      headers: authenticated(fixture.ownerAToken, key),
      method: "POST",
      payload: {
        baseUnit: { code: `KG-${key}`, decimalScale: 3, name: "Quilograma" },
        shortDescription: `Produto ${sku}`,
        sku,
      },
      url: "/api/v1/catalog/products",
    });
  }

  async function patchProduct(key: string, id: string, payload: Record<string, unknown>) {
    return application.inject({
      headers: authenticated(fixture.ownerAToken, key),
      method: "PATCH",
      payload,
      url: `/api/v1/catalog/products/${id}`,
    });
  }

  it("creates axes with their options and lists them together", async () => {
    const liga = await createDefinition("def-liga", { code: "LIGA", name: "Liga" });
    expect(liga.statusCode).toBe(201);
    const ligaId = liga.json<DefinitionResponse>().definition.id;

    await createOption("opt-1020", { code: "SAE-1020", definitionId: ligaId, name: "SAE 1020" });
    await createOption("opt-1045", { code: "SAE-1045", definitionId: ligaId, name: "SAE 1045" });

    const listed = await application.inject({
      headers: authenticated(fixture.ownerAToken),
      method: "GET",
      url: "/api/v1/catalog/attribute-definitions",
    });

    expect(listed.statusCode).toBe(200);
    const definition = listed
      .json<DefinitionListResponse>()
      .items.find((item) => item.code === "LIGA");
    expect(definition?.options.map((option) => option.code).sort()).toEqual([
      "SAE-1020",
      "SAE-1045",
    ]);
  });

  it("classifies the product already at creation", async () => {
    const axis = await createDefinition("def-nasce", { code: "NASCE", name: "Nasce" });
    const definitionId = axis.json<DefinitionResponse>().definition.id;
    const option = await createOption("opt-nasce", {
      code: "VALOR",
      definitionId,
      name: "Valor",
    });
    const optionId = option.json<OptionResponse>().option.id;

    const created = await application.inject({
      headers: authenticated(fixture.ownerAToken, "prod-nasce"),
      method: "POST",
      payload: {
        attributes: [{ definitionId, optionId }],
        baseUnit: { code: "KG-N1", decimalScale: 3, name: "Quilograma" },
        shortDescription: "Produto ja classificado",
        sku: "SKU-NASCE",
      },
      url: "/api/v1/catalog/products",
    });

    expect(created.statusCode).toBe(201);
    const attributes = created.json<{
      product: { attributes: { definitionCode: string; optionCode: string }[] };
    }>().product.attributes;
    expect(attributes).toEqual([
      expect.objectContaining({ definitionCode: "NASCE", optionCode: "VALOR" }),
    ]);
  });

  it("does not create the product when a faceta at creation is unknown", async () => {
    const created = await application.inject({
      headers: authenticated(fixture.ownerAToken, "prod-nasce-invalida"),
      method: "POST",
      payload: {
        attributes: [{ definitionId: randomUUID(), optionId: randomUUID() }],
        baseUnit: { code: "KG-N2", decimalScale: 3, name: "Quilograma" },
        shortDescription: "Produto que nao deve nascer",
        sku: "SKU-NASCE-INVALIDO",
      },
      url: "/api/v1/catalog/products",
    });

    expect(created.statusCode).toBe(404);

    // A transacao inteira volta atras: o produto nao pode existir sem a classificacao pedida.
    const listed = await application.inject({
      headers: authenticated(fixture.ownerAToken),
      method: "GET",
      url: "/api/v1/catalog/products?search=nao deve nascer",
    });
    expect(listed.json<{ items: unknown[] }>().items).toHaveLength(0);
  });

  it("normalizes the code and rejects a duplicate axis", async () => {
    const first = await createDefinition("def-proc", { code: " processo ", name: "Processo" });
    expect(first.json<DefinitionResponse>().definition.code).toBe("PROCESSO");

    const duplicate = await createDefinition("def-proc-again", {
      code: "PROCESSO",
      name: "Outro processo",
    });
    expect(duplicate.statusCode).toBe(409);
  });

  it("allows the same option code under different axes", async () => {
    const alpha = await createDefinition("def-alpha", { code: "ALPHA", name: "Alpha" });
    const beta = await createDefinition("def-beta", { code: "BETA", name: "Beta" });
    const alphaId = alpha.json<DefinitionResponse>().definition.id;
    const betaId = beta.json<DefinitionResponse>().definition.id;

    const first = await createOption("opt-shared-a", {
      code: "COMUM",
      definitionId: alphaId,
      name: "Comum",
    });
    const second = await createOption("opt-shared-b", {
      code: "COMUM",
      definitionId: betaId,
      name: "Comum",
    });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);

    // Repetir o código dentro do mesmo eixo continua sendo conflito.
    const repeated = await createOption("opt-shared-a-again", {
      code: "COMUM",
      definitionId: alphaId,
      name: "Comum de novo",
    });
    expect(repeated.statusCode).toBe(409);
  });

  it("assigns facets to a product and replaces the whole set on the next patch", async () => {
    const liga = await createDefinition("def-liga-2", { code: "LIGA2", name: "Liga 2" });
    const formato = await createDefinition("def-form", { code: "FORMATO", name: "Formato" });
    const ligaId = liga.json<DefinitionResponse>().definition.id;
    const formatoId = formato.json<DefinitionResponse>().definition.id;

    const sae1020 = await createOption("opt-l2-1020", {
      code: "SAE-1020",
      definitionId: ligaId,
      name: "SAE 1020",
    });
    const sae1045 = await createOption("opt-l2-1045", {
      code: "SAE-1045",
      definitionId: ligaId,
      name: "SAE 1045",
    });
    const redondo = await createOption("opt-redondo", {
      code: "REDONDO",
      definitionId: formatoId,
      name: "Redondo",
    });

    const sae1020Id = sae1020.json<OptionResponse>().option.id;
    const sae1045Id = sae1045.json<OptionResponse>().option.id;
    const redondoId = redondo.json<OptionResponse>().option.id;

    const product = await createProduct("prod-attr", "ATTR-001");
    const productId = product.json<ProductResponse>().product.id;

    const assigned = await patchProduct("patch-attr-1", productId, {
      attributes: [
        { definitionId: ligaId, optionId: sae1020Id },
        { definitionId: formatoId, optionId: redondoId },
      ],
    });

    expect(assigned.statusCode).toBe(200);
    const first = assigned.json<{ product: ProductDetailResponse["product"] }>().product;
    expect(first.attributes).toHaveLength(2);
    expect(first.attributes.map((entry) => entry.optionCode).sort()).toEqual([
      "REDONDO",
      "SAE-1020",
    ]);

    // O conjunto enviado substitui o anterior: a liga muda e o formato some.
    const replaced = await patchProduct("patch-attr-2", productId, {
      attributes: [{ definitionId: ligaId, optionId: sae1045Id }],
    });

    const second = replaced.json<{ product: ProductDetailResponse["product"] }>().product;
    expect(second.attributes).toHaveLength(1);
    expect(second.attributes[0]?.optionCode).toBe("SAE-1045");

    // Array vazio remove todas.
    const cleared = await patchProduct("patch-attr-3", productId, { attributes: [] });
    expect(
      cleared.json<{ product: ProductDetailResponse["product"] }>().product.attributes,
    ).toEqual([]);
  });

  it("refuses two values for the same axis", async () => {
    const definition = await createDefinition("def-dup", { code: "DUPEIXO", name: "Dup" });
    const definitionId = definition.json<DefinitionResponse>().definition.id;
    const one = await createOption("opt-dup-1", {
      code: "UM",
      definitionId,
      name: "Um",
    });
    const two = await createOption("opt-dup-2", {
      code: "DOIS",
      definitionId,
      name: "Dois",
    });

    const product = await createProduct("prod-dup", "ATTR-DUP");
    const productId = product.json<ProductResponse>().product.id;

    const response = await patchProduct("patch-dup", productId, {
      attributes: [
        { definitionId, optionId: one.json<OptionResponse>().option.id },
        { definitionId, optionId: two.json<OptionResponse>().option.id },
      ],
    });

    expect(response.statusCode).toBe(409);
  });

  it("refuses an option that belongs to another axis", async () => {
    const ligaDefinition = await createDefinition("def-x", { code: "EIXOX", name: "Eixo X" });
    const outroDefinition = await createDefinition("def-y", { code: "EIXOY", name: "Eixo Y" });
    const ligaId = ligaDefinition.json<DefinitionResponse>().definition.id;
    const outroId = outroDefinition.json<DefinitionResponse>().definition.id;
    const option = await createOption("opt-x", {
      code: "VALORX",
      definitionId: ligaId,
      name: "Valor X",
    });

    const product = await createProduct("prod-cross", "ATTR-CROSS");
    const productId = product.json<ProductResponse>().product.id;

    // A opção existe, mas sob outro eixo: o vínculo declarado é incoerente.
    const response = await patchProduct("patch-cross", productId, {
      attributes: [{ definitionId: outroId, optionId: option.json<OptionResponse>().option.id }],
    });

    expect(response.statusCode).toBe(404);
  });

  it("keeps axes isolated between organizations", async () => {
    const foreign = await createDefinition(
      "def-foreign",
      { code: "SOMENTE-B", name: "Somente B" },
      fixture.ownerBToken,
    );
    const foreignId = foreign.json<DefinitionResponse>().definition.id;

    const listedForA = await application.inject({
      headers: authenticated(fixture.ownerAToken),
      method: "GET",
      url: "/api/v1/catalog/attribute-definitions",
    });
    expect(
      listedForA.json<DefinitionListResponse>().items.some((item) => item.code === "SOMENTE-B"),
    ).toBe(false);

    // Criar opção no eixo da outra organização responde 404, não 403: o recurso não existe para A.
    const crossTenant = await createOption("opt-foreign", {
      code: "TENTATIVA",
      definitionId: foreignId,
      name: "Tentativa",
    });
    expect(crossTenant.statusCode).toBe(404);
  });

  it("restricts writes to owner and admin but allows any member to read", async () => {
    const forbidden = await createDefinition(
      "def-member",
      { code: "NEGADO", name: "Negado" },
      fixture.memberToken,
    );
    expect(forbidden.statusCode).toBe(403);

    const readable = await application.inject({
      headers: authenticated(fixture.memberToken),
      method: "GET",
      url: "/api/v1/catalog/attribute-definitions",
    });
    expect(readable.statusCode).toBe(200);
  });

  it("replays the create response for a repeated idempotency key", async () => {
    const first = await createDefinition("def-idem", { code: "IDEM", name: "Idempotente" });
    const second = await createDefinition("def-idem", { code: "IDEM", name: "Idempotente" });

    expect(first.json<DefinitionResponse>().replayed).toBe(false);
    expect(second.json<DefinitionResponse>().replayed).toBe(true);
    expect(second.json<DefinitionResponse>().definition.id).toBe(
      first.json<DefinitionResponse>().definition.id,
    );
  });

  it("renames and deactivates without touching the code", async () => {
    const created = await createDefinition("def-rename", { code: "RENOMEAR", name: "Antes" });
    const definitionId = created.json<DefinitionResponse>().definition.id;

    const updated = await application.inject({
      headers: authenticated(fixture.ownerAToken, "patch-rename"),
      method: "PATCH",
      payload: { active: false, name: "Depois" },
      url: `/api/v1/catalog/attribute-definitions/${definitionId}`,
    });

    expect(updated.statusCode).toBe(200);
    const definition = updated.json<DefinitionResponse>().definition;
    expect(definition.name).toBe("Depois");
    expect(definition.active).toBe(false);
    expect(definition.code).toBe("RENOMEAR");

    // Trocar o código quebraria vínculos já gravados, então a rota recusa.
    const rejected = await application.inject({
      headers: authenticated(fixture.ownerAToken, "patch-rename-code"),
      method: "PATCH",
      payload: { code: "OUTRO" },
      url: `/api/v1/catalog/attribute-definitions/${definitionId}`,
    });
    expect(rejected.statusCode).toBe(400);
  });
});
