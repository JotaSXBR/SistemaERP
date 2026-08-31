import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import "reflect-metadata";

import { createApplication } from "./bootstrap.js";
import { readApplicationConfig } from "./configuration/application-config.js";

try {
  loadEnvFile(fileURLToPath(new URL("../../../.env", import.meta.url)));
} catch (error) {
  if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
    throw error;
  }
}

const config = readApplicationConfig();
const application = await createApplication();

application.enableShutdownHooks();
await application.listen(config.port, config.host);
