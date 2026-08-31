import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createApplication } from "../src/bootstrap.js";
import { DatabaseService } from "../src/database/database.service.js";

describe("API integration", () => {
  let application: NestFastifyApplication;

  beforeAll(async () => {
    try {
      loadEnvFile(fileURLToPath(new URL("../../../.env", import.meta.url)));
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
        throw error;
      }
    }

    application = await createApplication({ logger: false });
    await application.init();
    await application.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await application.close();
  });

  it("reports liveness with traceable response headers", async () => {
    const response = await application.inject({
      headers: { "x-correlation-id": "integration-test" },
      method: "GET",
      url: "/api/v1/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    expect(response.headers["x-correlation-id"]).toBe("integration-test");
    expect(response.headers["x-request-id"]).toMatch(/^req_[a-f0-9]{32}$/);
  });

  it("reports readiness after checking PostgreSQL", async () => {
    const response = await application.inject({
      method: "GET",
      url: "/api/v1/health/ready",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ checks: { database: "up" }, status: "ok" });
  });

  it("reports unavailable readiness without leaking database details", async () => {
    vi.spyOn(application.get(DatabaseService), "ping").mockRejectedValueOnce(
      new Error("sensitive database connection detail"),
    );

    const response = await application.inject({
      method: "GET",
      url: "/api/v1/health/ready",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      error: {
        code: "SERVICE_UNAVAILABLE",
        details: {},
        message: "Serviço temporariamente indisponível",
      },
    });
    expect(response.body).not.toContain("sensitive database connection detail");
  });

  it("publishes an OpenAPI contract", async () => {
    const response = await application.inject({ method: "GET", url: "/openapi.json" });
    const document = response.json<Record<string, unknown>>();

    expect(response.statusCode).toBe(200);
    expect(document.openapi).toMatch(/^3\./);
    expect(document.paths).toHaveProperty("/api/v1/health");
    expect(document.paths).toHaveProperty("/api/v1/health/ready");
  });

  it("uses the public error envelope without exposing internals", async () => {
    const response = await application.inject({ method: "GET", url: "/api/v1/missing" });
    const body = response.json<{
      error: { code: string; details: object; message: string; requestId: string };
    }>();

    expect(response.statusCode).toBe(404);
    expect(body.error).toMatchObject({
      code: "RESOURCE_NOT_FOUND",
      details: {},
      message: "Recurso não encontrado",
    });
    expect(body.error.requestId).toBe(response.headers["x-request-id"]);
  });
});
