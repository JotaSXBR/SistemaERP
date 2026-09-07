import { randomBytes, randomUUID, scryptSync } from "node:crypto";

import { test as base, expect, type Page } from "@playwright/test";
import { createDatabaseClient } from "@sistema-erp/database";

type Account = { email: string; password: string; organizationSlug: string };

// Each attempt owns a tenant, including retries. Keep audit evidence intact in the
// disposable test database instead of disabling its immutable-audit trigger.
export const test = base.extend<{ account: Account }>({
  account: async ({ browserName }, use) => {
    if (process.env.NODE_ENV !== "test") {
      throw new Error("Business E2E requires NODE_ENV=test and a disposable migrated database");
    }
    const suffix = randomUUID();
    const account = {
      email: `e2e-${suffix}@example.test`,
      organizationSlug: `e2e-${browserName}-${suffix}`,
      password: randomBytes(24).toString("hex"),
    };
    const salt = randomBytes(16).toString("hex");
    const passwordHash = `scrypt$${salt}$${scryptSync(account.password, salt, 64).toString("hex")}`;
    const database = createDatabaseClient();
    try {
      await database.$transaction(async (transaction) => {
        const organization = await transaction.organization.create({
          data: {
            fiscalTaxId: "22222222222222",
            name: "Empresa sintética E2E",
            slug: account.organizationSlug,
          },
        });
        const user = await transaction.user.create({
          data: { email: account.email, name: "Usuário sintético E2E", passwordHash },
        });
        await transaction.membership.create({
          data: { organizationId: organization.id, userId: user.id, role: "OWNER" },
        });
      });
    } finally {
      await database.$disconnect();
    }
    await use(account);
  },
});

export { expect };

export async function signIn(page: Page, account: Account, path: string) {
  await page.goto(path);
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("E-mail", { exact: true }).fill(account.email);
  await page.getByLabel("Empresa", { exact: true }).fill(account.organizationSlug);
  await page.getByLabel("Senha", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
}
