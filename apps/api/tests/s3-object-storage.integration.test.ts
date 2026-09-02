import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "node:process";

import { afterAll, describe, expect, it } from "vitest";

import {
  ObjectStorageConflictError,
  ObjectStorageIntegrityError,
  ObjectStorageObjectNotFoundError,
} from "../src/fiscal-intake/application/object-storage.js";
import { S3ObjectStorageAdapter } from "../src/fiscal-intake/infrastructure/s3-object-storage.adapter.js";

try {
  loadEnvFile(fileURLToPath(new URL("../../../.env", import.meta.url)));
} catch (error) {
  if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
    throw error;
  }
}

const runIntegrationTests = process.env.S3_INTEGRATION_TESTS === "true";
const integration = describe.runIf(runIntegrationTests);

integration("S3ObjectStorageAdapter", () => {
  const adapter = new S3ObjectStorageAdapter({
    accessKeyId: requiredEnvironment("MINIO_ROOT_USER"),
    bucket: requiredEnvironment("MINIO_BUCKET"),
    endpoint:
      process.env.S3_TEST_ENDPOINT ?? `http://127.0.0.1:${process.env.MINIO_API_PORT ?? "9000"}`,
    forcePathStyle: true,
    region: process.env.S3_TEST_REGION ?? "us-east-1",
    secretAccessKey: requiredEnvironment("MINIO_ROOT_PASSWORD"),
  });

  afterAll(() => {
    adapter.destroy();
  });

  it("writes, inspects and reads a private versioned object", async () => {
    const body = Buffer.from("synthetic fiscal document", "utf8");
    const input = {
      body,
      contentType: "application/xml",
      key: `integration/${randomUUID()}.xml`,
      sha256: createHash("sha256").update(body).digest("hex"),
    };

    const stored = await adapter.put(input);
    const reference = {
      key: input.key,
      ...(stored.versionId === undefined ? {} : { versionId: stored.versionId }),
    };
    const metadata = await adapter.head(reference);
    const downloaded = await adapter.get(reference);

    expect(stored.versionId).toBeTruthy();
    expect(metadata).toMatchObject({
      contentLength: body.byteLength,
      contentType: input.contentType,
      key: input.key,
      sha256: input.sha256,
      versionId: stored.versionId,
    });
    expect(Buffer.from(downloaded.body)).toEqual(body);
  });

  it("returns the existing object for an identical retry and rejects divergent content", async () => {
    const body = Buffer.from("idempotent synthetic content", "utf8");
    const input = {
      body,
      contentType: "application/xml",
      key: `integration/${randomUUID()}.xml`,
      sha256: createHash("sha256").update(body).digest("hex"),
    };

    const first = await adapter.put(input);
    const retry = await adapter.put(input);
    const differentBody = Buffer.from("different content", "utf8");

    expect(retry.versionId).toBe(first.versionId);
    await expect(
      adapter.put({
        ...input,
        body: differentBody,
        sha256: createHash("sha256").update(differentBody).digest("hex"),
      }),
    ).rejects.toBeInstanceOf(ObjectStorageConflictError);
  });

  it("rejects a body whose declared SHA-256 is invalid", async () => {
    await expect(
      adapter.put({
        body: Buffer.from("synthetic content", "utf8"),
        contentType: "application/xml",
        key: `integration/${randomUUID()}.xml`,
        sha256: "0".repeat(64),
      }),
    ).rejects.toBeInstanceOf(ObjectStorageIntegrityError);
  });

  it("uses explicit not-found behavior", async () => {
    const key = `integration/missing-${randomUUID()}.xml`;

    await expect(adapter.head({ key })).resolves.toBeNull();
    await expect(adapter.get({ key })).rejects.toBeInstanceOf(ObjectStorageObjectNotFoundError);
  });
});

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (runIntegrationTests && (value === undefined || value.length === 0)) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value ?? "integration-test-disabled";
}
