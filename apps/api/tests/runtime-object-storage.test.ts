import { createHash } from "node:crypto";

import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { createRuntimeObjectStorage } from "../src/fiscal-intake/infrastructure/runtime-object-storage.js";

describe("runtime object storage", () => {
  it("uses deterministic in-memory storage in tests", async () => {
    const storage = createRuntimeObjectStorage({ NODE_ENV: "test" });
    const body = Buffer.from("synthetic XML", "utf8");
    const input = {
      body,
      contentType: "application/xml",
      key: "tenant/fiscal/test.xml",
      sha256: createHash("sha256").update(body).digest("hex"),
    };

    const stored = await storage.put(input);

    await expect(storage.head(stored)).resolves.toMatchObject({
      contentLength: body.byteLength,
      sha256: input.sha256,
    });
  });

  it("blocks the global runtime provider in production", async () => {
    const storage = createRuntimeObjectStorage({ NODE_ENV: "production" });

    await expect(storage.head({ key: "tenant/fiscal/test.xml" })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
