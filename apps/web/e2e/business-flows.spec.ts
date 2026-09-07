import { fileURLToPath } from "node:url";

import { expect, signIn, test } from "./fixtures.js";

test("autentica, preserva a sessão após recarregar e revoga ao sair", async ({ page, account }) => {
  await signIn(page, account, "/organization");
  await page.reload();
  await expect(page.getByRole("button", { name: "Sair", exact: true })).toBeVisible();

  const revoked = page.waitForResponse(
    (response) =>
      response.url().endsWith("/auth/sessions/current/revoke") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  expect((await revoked).status()).toBe(204);
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/products");
  await expect(page).toHaveURL(/\/login$/);
});

test("cadastra um produto e recupera o registro após recarregar", async ({ page, account }) => {
  await signIn(page, account, "/products");
  await page.getByRole("button", { name: "Novo produto", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Novo produto" });
  await drawer.getByLabel("SKU", { exact: true }).fill("E2E-001");
  await drawer.getByLabel("Descrição curta", { exact: true }).fill("Produto sintético E2E");
  await drawer.getByLabel("Código", { exact: true }).fill("KG");
  await drawer.getByLabel("Nome", { exact: true }).fill("Quilograma");
  await drawer.getByLabel("Casas decimais", { exact: true }).fill("4");
  await drawer.getByRole("button", { name: "Cadastrar produto", exact: true }).click();
  await expect(drawer).toBeHidden();
  await page.reload();
  const row = page.getByRole("row").filter({ hasText: "E2E-001" });
  await expect(row).toContainText("Produto sintético E2E");
  await expect(row).toContainText("Quilograma (KG)");
});

test("importa XML sintético, recupera a inbox e não duplica na reimportação", async ({
  page,
  account,
}) => {
  await signIn(page, account, "/fiscal-intake");
  const xml = fileURLToPath(new URL("../../api/tests/fixtures/nfe-synthetic.xml", import.meta.url));
  const preview = page.getByRole("region", { name: "Prévia do documento" });
  const inbox = page.getByRole("complementary", { name: "Documentos importados" });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.getByLabel("XML da NF-e", { exact: true }).setInputFiles(xml);
    await page.getByRole("button", { name: "Importar XML", exact: true }).click();
    await expect(page.getByLabel("XML da NF-e", { exact: true })).toHaveValue("");
    await expect(
      preview.getByRole("heading", { name: "FORNECEDOR SINTETICO", exact: true }),
    ).toBeVisible();
    await expect(preview.getByText("Fornecedor precisa de atenção", { exact: true })).toBeVisible();
    await expect(preview.getByText("PERFIL METALICO SINTETICO", { exact: true })).toBeVisible();
    await expect(inbox.getByRole("button")).toHaveCount(1);
    await page.reload();
    await expect(
      preview.getByRole("heading", { name: "FORNECEDOR SINTETICO", exact: true }),
    ).toBeVisible();
    await expect(inbox.getByRole("button")).toHaveCount(1);
  }
});
