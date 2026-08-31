import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { createApplication } from "../src/bootstrap.js";

const outputPath = fileURLToPath(
  new URL("../../../packages/contracts/openapi/openapi.json", import.meta.url),
);
const application = await createApplication({ logger: false });

try {
  await application.init();
  await application.getHttpAdapter().getInstance().ready();

  const response = await application.inject({ method: "GET", url: "/openapi.json" });

  if (response.statusCode !== 200) {
    throw new Error(`OpenAPI export failed with HTTP ${response.statusCode}`);
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(response.json(), undefined, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ event: "openapi.exported", outputPath })}\n`);
} finally {
  await application.close();
}
