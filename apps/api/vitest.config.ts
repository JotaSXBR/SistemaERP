import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Os testes de integração compartilham o PostgreSQL e alternam temporariamente
    // o trigger imutável de auditoria durante a limpeza das próprias fixtures.
    fileParallelism: false,
  },
});
