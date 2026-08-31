import { createDatabaseClient } from "../src/index.js";

if (process.env.NODE_ENV === "production") {
  throw new Error("Development seed must not run with NODE_ENV=production");
}

const database = createDatabaseClient();

try {
  await database.$queryRaw`SELECT 1`;
  process.stdout.write(
    `${JSON.stringify({ event: "database.seed.completed", insertedRecords: 0 })}\n`,
  );
} finally {
  await database.$disconnect();
}
