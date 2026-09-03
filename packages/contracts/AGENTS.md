# Regras de `packages/contracts`

Este arquivo complementa o `AGENTS.md` da raiz e implementa o contrato definido no ADR-0004.

## Responsabilidade

- A especificação OpenAPI publicada pela API é a fonte do contrato HTTP.
- O frontend consome o cliente TypeScript gerado; não importa tipos internos do NestJS.
- Mudanças incompatíveis devem ficar explícitas no diff da especificação e do SDK.
- O pacote não contém regras de negócio nem adaptações específicas de tela.

## Arquivos gerados

- `openapi/openapi.json` é exportado pela aplicação NestJS.
- `src/generated/` é produzido por `@hey-api/openapi-ts` a partir do OpenAPI.
- Nunca edite esses caminhos manualmente, mesmo para correções pequenas.
- `openapi-ts.config.ts` é configuração fonte e pode ser alterado com justificativa.
- `src/index.ts` e outros arquivos não gerados devem manter uma superfície pública mínima.

## Fluxo de atualização

1. Altere DTOs/controllers na API.
2. Execute `pnpm contracts:generate` na raiz.
3. Revise o OpenAPI e o SDK gerados para mudanças inesperadas.
4. Adapte consumidores e execute `pnpm contracts:check` antes do PR.

`contracts:check` regenera os artefatos e falha quando o resultado difere do que está versionado.
Em uma alteração legítima, gere e inclua os artefatos no mesmo commit da mudança de contrato.

## Comandos locais

```bash
pnpm --filter @sistema-erp/contracts generate
pnpm --filter @sistema-erp/contracts typecheck
pnpm --filter @sistema-erp/contracts build
pnpm contracts:generate
pnpm contracts:check
```

- Execute geração pela raiz quando precisar exportar a especificação a partir da API.
- Não publique manualmente este pacote; ele é interno ao monorepo enquanto não houver decisão em
  contrário.
