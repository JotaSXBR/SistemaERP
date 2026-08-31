import { describe, expect, it } from "vitest";

import { readApplicationConfig } from "../src/configuration/application-config.js";

describe("application configuration", () => {
  it("uses safe defaults and requires the database URL", () => {
    expect(readApplicationConfig({ DATABASE_URL: "postgresql://local" })).toEqual({
      host: "0.0.0.0",
      nodeEnvironment: "development",
      port: 3000,
    });
  });

  it.each(["0", "65536", "3.14", "invalid"])("rejects invalid API_PORT %s", (apiPort) => {
    expect(() =>
      readApplicationConfig({ API_PORT: apiPort, DATABASE_URL: "postgresql://local" }),
    ).toThrow("API_PORT must be an integer between 1 and 65535");
  });

  it("rejects a missing database URL", () => {
    expect(() => readApplicationConfig({})).toThrow("DATABASE_URL is required");
  });
});
