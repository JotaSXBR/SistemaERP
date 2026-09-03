import { randomUUID } from "node:crypto";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { createDatabaseClient, MembershipRole, type DatabaseClient } from "@sistema-erp/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApplication } from "../src/bootstrap.js";
import { hashPassword } from "../src/identity/password.js";

type Fixture = {
  candidateUserId: string;
  memberToken: string;
  organizationAId: string;
  organizationBId: string;
  ownerAToken: string;
  ownerBToken: string;
  userIds: string[];
};

type SessionResponse = {
  organizationId: string;
  role: string;
  token: string;
  userId: string;
};

describe("platform security primitives", () => {
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

  async function login(email: string, organizationSlug: string, password = "valid_password") {
    return application.inject({
      method: "POST",
      payload: { email, organizationSlug, password },
      url: "/api/v1/auth/sessions",
    });
  }

  async function createFixture(): Promise<Fixture> {
    const suffix = randomUUID().slice(0, 8);
    const passwordHash = await hashPassword("valid_password");
    const [organizationA, organizationB] = await Promise.all([
      database.organization.create({ data: { name: "Tenant A", slug: `tenant-a-${suffix}` } }),
      database.organization.create({ data: { name: "Tenant B", slug: `tenant-b-${suffix}` } }),
    ]);
    const [ownerA, ownerB, member, candidate] = await Promise.all([
      database.user.create({
        data: { email: `owner-a-${suffix}@example.test`, name: "Owner A", passwordHash },
      }),
      database.user.create({
        data: { email: `owner-b-${suffix}@example.test`, name: "Owner B", passwordHash },
      }),
      database.user.create({
        data: { email: `member-${suffix}@example.test`, name: "Member A", passwordHash },
      }),
      database.user.create({
        data: { email: `candidate-${suffix}@example.test`, name: "Candidate", passwordHash },
      }),
    ]);

    await database.membership.createMany({
      data: [
        { organizationId: organizationA.id, role: "OWNER", userId: ownerA.id },
        { organizationId: organizationA.id, role: "MEMBER", userId: member.id },
        { organizationId: organizationB.id, role: "OWNER", userId: ownerB.id },
      ],
    });

    const [ownerALogin, ownerBLogin, memberLogin] = await Promise.all([
      login(ownerA.email, organizationA.slug),
      login(ownerB.email, organizationB.slug),
      login(member.email, organizationA.slug),
    ]);

    expect(ownerALogin.statusCode).toBe(201);
    expect(ownerBLogin.statusCode).toBe(201);
    expect(memberLogin.statusCode).toBe(201);

    return {
      candidateUserId: candidate.id,
      memberToken: memberLogin.json<SessionResponse>().token,
      organizationAId: organizationA.id,
      organizationBId: organizationB.id,
      ownerAToken: ownerALogin.json<SessionResponse>().token,
      ownerBToken: ownerBLogin.json<SessionResponse>().token,
      userIds: [ownerA.id, ownerB.id, member.id, candidate.id],
    };
  }

  it("requires a valid session and fixes the tenant context", async () => {
    const unauthorized = await application.inject({
      method: "GET",
      url: "/api/v1/organizations/current",
    });
    const current = await application.inject({
      headers: { authorization: `Bearer ${fixture.ownerAToken}` },
      method: "GET",
      url: "/api/v1/organizations/current",
    });

    expect(unauthorized.statusCode).toBe(401);
    expect(current.statusCode).toBe(200);
    expect(current.json()).toMatchObject({ id: fixture.organizationAId, name: "Tenant A" });
  });

  it("sets the current organization fiscal identity idempotently with owner authorization", async () => {
    const request = {
      headers: {
        authorization: `Bearer ${fixture.ownerAToken}`,
        "idempotency-key": "organization-fiscal-identity",
      },
      method: "PATCH" as const,
      payload: { taxId: "22.222.222/2222-22" },
      url: "/api/v1/organizations/current/fiscal-identity",
    };
    const first = await application.inject(request);
    const replay = await application.inject(request);
    const tenantAttempt = await application.inject({
      ...request,
      headers: {
        authorization: `Bearer ${fixture.ownerBToken}`,
        "idempotency-key": "organization-fiscal-identity-tenant-attempt",
      },
      payload: { organizationId: fixture.organizationAId, taxId: "33333333333333" },
    });
    const denied = await application.inject({
      ...request,
      headers: {
        authorization: `Bearer ${fixture.memberToken}`,
        "idempotency-key": "organization-fiscal-identity-member",
      },
    });

    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ replayed: false, taxId: "22222222222222" });
    expect(replay.json()).toEqual({ replayed: true, taxId: "22222222222222" });
    expect(tenantAttempt.statusCode).toBe(400);
    expect(denied.statusCode).toBe(403);
    expect(
      await database.auditEvent.count({
        where: {
          action: "organizations.fiscal-identity.updated",
          organizationId: fixture.organizationAId,
        },
      }),
    ).toBe(1);
  });

  it("rejects invalid credentials without issuing a session", async () => {
    const response = await login("unknown@example.test", "unknown", "wrong_password");

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  it("enforces RBAC before listing memberships", async () => {
    const response = await application.inject({
      headers: { authorization: `Bearer ${fixture.memberToken}` },
      method: "GET",
      url: "/api/v1/organizations/current/memberships",
    });

    expect(response.statusCode).toBe(403);
  });

  it("never accepts organizationId from the request body", async () => {
    const response = await application.inject({
      headers: {
        authorization: `Bearer ${fixture.ownerAToken}`,
        "idempotency-key": "body-tenant-attempt",
      },
      method: "POST",
      payload: {
        email: "candidate@example.test",
        organizationId: fixture.organizationBId,
        role: MembershipRole.MEMBER,
      },
      url: "/api/v1/organizations/current/memberships",
    });

    expect(response.statusCode).toBe(400);
  });

  it("isolates membership queries by the authenticated tenant", async () => {
    const response = await application.inject({
      headers: { authorization: `Bearer ${fixture.ownerAToken}` },
      method: "GET",
      url: "/api/v1/organizations/current/memberships",
    });
    const memberships = response.json<Array<{ userId: string }>>();

    expect(response.statusCode).toBe(200);
    expect(memberships).not.toContainEqual(expect.objectContaining({ userId: fixture.userIds[1] }));
  });

  it("replays an idempotent membership creation and rejects changed payloads", async () => {
    const candidate = await database.user.findUniqueOrThrow({
      where: { id: fixture.candidateUserId },
    });
    const request = {
      headers: {
        authorization: `Bearer ${fixture.ownerAToken}`,
        "idempotency-key": "membership-candidate",
      },
      method: "POST" as const,
      payload: { email: candidate.email, role: MembershipRole.MEMBER },
      url: "/api/v1/organizations/current/memberships",
    };
    const first = await application.inject(request);
    const replay = await application.inject(request);
    const conflict = await application.inject({
      ...request,
      payload: { email: candidate.email, role: MembershipRole.ADMIN },
    });

    expect(first.statusCode).toBe(201);
    expect(first.json()).toMatchObject({ replayed: false });
    expect(replay.statusCode).toBe(201);
    expect(replay.json()).toMatchObject({ replayed: true });
    expect(conflict.statusCode).toBe(409);
    expect(
      await database.membership.count({
        where: { organizationId: fixture.organizationAId, userId: candidate.id },
      }),
    ).toBe(1);
    expect(
      await database.auditEvent.count({
        where: {
          action: "organizations.membership.created",
          organizationId: fixture.organizationAId,
        },
      }),
    ).toBe(1);
  });

  it("returns only audit events from the authenticated organization", async () => {
    const response = await application.inject({
      headers: { authorization: `Bearer ${fixture.ownerAToken}` },
      method: "GET",
      url: "/api/v1/audit/events",
    });
    const events = response.json<Array<{ id: string }>>();
    const organizationBEventIds = await database.auditEvent.findMany({
      select: { id: true },
      where: { organizationId: fixture.organizationBId },
    });

    expect(response.statusCode).toBe(200);
    expect(events.length).toBeGreaterThan(0);
    expect(events.map(({ id }) => id)).not.toEqual(
      expect.arrayContaining(organizationBEventIds.map(({ id }) => id)),
    );
  });

  it("prevents updates and deletes of audit events in PostgreSQL", async () => {
    const event = await database.auditEvent.findFirstOrThrow({
      where: { organizationId: fixture.organizationAId },
    });

    await expect(
      database.auditEvent.update({ data: { action: "tampered" }, where: { id: event.id } }),
    ).rejects.toThrow("audit_events are immutable");
    await expect(database.auditEvent.delete({ where: { id: event.id } })).rejects.toThrow(
      "audit_events are immutable",
    );
  });

  it("revokes the current session", async () => {
    const revoke = await application.inject({
      headers: { authorization: `Bearer ${fixture.ownerBToken}` },
      method: "POST",
      url: "/api/v1/auth/sessions/current/revoke",
    });
    const afterRevoke = await application.inject({
      headers: { authorization: `Bearer ${fixture.ownerBToken}` },
      method: "GET",
      url: "/api/v1/auth/session",
    });

    expect(revoke.statusCode).toBe(204);
    expect(afterRevoke.statusCode).toBe(401);
  });
});
