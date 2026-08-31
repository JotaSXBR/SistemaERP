import { expect, test } from "@playwright/test";

test("exibe a prontidão da API e do PostgreSQL", async ({ page }) => {
  await page.goto("/diagnostics");

  await expect(page.getByRole("heading", { name: "Diagnóstico do sistema" })).toBeVisible();

  const services = page.getByRole("region", { name: "Estado dos serviços" });
  await expect(services.getByText("Operacional")).toHaveCount(2);
  await expect(services.getByText(/^req_[a-f0-9]{32}$/)).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Verificar novamente" })).toBeEnabled();
});
