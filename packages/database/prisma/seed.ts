import { randomBytes, scryptSync } from "node:crypto";

import { createDatabaseClient } from "../src/index.js";

if (process.env.NODE_ENV === "production") {
  throw new Error("Development seed must not run with NODE_ENV=production");
}

const database = createDatabaseClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");

  return `scrypt$${salt}$${derivedKey}`;
}

try {
  const organization = await database.organization.upsert({
    create: { fiscalTaxId: "22222222222222", name: "Empresa de demonstração", slug: "demo" },
    update: { fiscalTaxId: "22222222222222" },
    where: { slug: "demo" },
  });
  const user = await database.user.upsert({
    create: {
      email: "admin@example.test",
      name: "Administrador local",
      passwordHash: hashPassword(process.env.SEED_ADMIN_PASSWORD ?? "local_admin_only"),
    },
    update: {},
    where: { email: "admin@example.test" },
  });
  await database.membership.upsert({
    create: {
      organizationId: organization.id,
      role: "OWNER",
      userId: user.id,
    },
    update: {},
    where: {
      organizationId_userId: { organizationId: organization.id, userId: user.id },
    },
  });

  process.stdout.write(
    `${JSON.stringify({ event: "database.seed.completed", organizationSlug: organization.slug })}\n`,
  );
} finally {
  await database.$disconnect();
}
