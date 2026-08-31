export type NodeEnvironment = "development" | "production" | "test";

export type ApplicationConfig = {
  host: string;
  nodeEnvironment: NodeEnvironment;
  port: number;
};

const NODE_ENVIRONMENTS = new Set<NodeEnvironment>(["development", "production", "test"]);

export function readApplicationConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ApplicationConfig {
  const host = environment.API_HOST?.trim() || "0.0.0.0";
  const portValue = environment.API_PORT?.trim() || "3000";
  const nodeEnvironment = environment.NODE_ENV?.trim() || "development";
  const port = Number(portValue);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("API_PORT must be an integer between 1 and 65535");
  }

  if (!NODE_ENVIRONMENTS.has(nodeEnvironment as NodeEnvironment)) {
    throw new Error("NODE_ENV must be development, production, or test");
  }

  if (!environment.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required");
  }

  return {
    host,
    nodeEnvironment: nodeEnvironment as NodeEnvironment,
    port,
  };
}
