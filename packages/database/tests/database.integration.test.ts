import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient, type DatabaseClient } from "../src/index.js";

type DatabaseProbe = {
  baselineApplied: boolean;
  databaseName: string;
  databaseUser: string;
  fiscalInboxApplied: boolean;
  platformPrimitivesApplied: boolean;
  timezone: string;
};

type NumericProbe = {
  amount: unknown;
};

describe("PostgreSQL integration", () => {
  let database: DatabaseClient;

  beforeAll(() => {
    try {
      loadEnvFile(fileURLToPath(new URL("../../../.env", import.meta.url)));
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
        throw error;
      }
    }

    database = createDatabaseClient();
  });

  afterAll(async () => {
    await database.$disconnect();
  });

  it("connects through Prisma with the expected local settings and migration", async () => {
    const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
    const [probe] = await database.$queryRaw<DatabaseProbe[]>`
      SELECT
        current_database() AS "databaseName",
        current_user AS "databaseUser",
        current_setting('TimeZone') AS timezone,
        EXISTS (
          SELECT 1
          FROM "_prisma_migrations"
          WHERE migration_name = '20260831150000_initial_baseline'
            AND finished_at IS NOT NULL
        ) AS "baselineApplied",
        EXISTS (
          SELECT 1
          FROM "_prisma_migrations"
          WHERE migration_name = '20260831181000_enforce_audit_immutability'
            AND finished_at IS NOT NULL
        ) AS "platformPrimitivesApplied",
        EXISTS (
          SELECT 1
          FROM "_prisma_migrations"
          WHERE migration_name = '20260902125000_fiscal_inbox_constraints'
            AND finished_at IS NOT NULL
        ) AS "fiscalInboxApplied"
    `;

    expect(probe).toEqual({
      baselineApplied: true,
      databaseName: databaseUrl.pathname.slice(1),
      databaseUser: decodeURIComponent(databaseUrl.username),
      fiscalInboxApplied: true,
      platformPrimitivesApplied: true,
      timezone: "UTC",
    });
  });

  it("does not coerce PostgreSQL numeric values to JavaScript floating point", async () => {
    const [probe] = await database.$queryRaw<NumericProbe[]>`
      SELECT 1234567890.1234::numeric AS amount
    `;

    expect(typeof probe?.amount).not.toBe("number");
    expect(String(probe?.amount)).toBe("1234567890.1234");
  });
});
