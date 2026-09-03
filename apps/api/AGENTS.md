# Regras de `apps/api`

Este arquivo complementa o `AGENTS.md` da raiz. As convenções normativas estão em
`docs/conventions/backend.md` e `docs/conventions/testing.md`.

## Arquitetura

- A API é um monólito modular NestJS com adapter Fastify; não extraia serviços sem ADR.
- Controllers traduzem HTTP e chamam serviços/casos de uso; não contêm regra de negócio nem acesso
  direto ao Prisma.
- Módulos se comunicam por APIs públicas. Evite imports profundos entre módulos.
- Requisições autenticadas usam o contexto vigente para `userId`, `organizationId`, `requestId` e
  `correlationId`.
- Rotas ficam sob `/api/v1`, usam recursos em inglês e documentam respostas e erros no Swagger.
- Entradas são validadas na fronteira; erros públicos têm códigos estáveis e não expõem internals.
- Endpoints caros ou sensíveis precisam de autorização e rate limiting proporcional.

## Persistência e domínio

- Acesso ao banco passa por providers ou repositórios, nunca pelo controller.
- Consultas de negócio incluem o tenant e têm teste negativo de isolamento.
- Dinheiro e quantidades exatas não usam ponto flutuante.
- Mutations relevantes são auditadas; integrações e retries são idempotentes.
- XMLs, tokens, segredos e conteúdo fiscal sensível não aparecem em logs ou erros.

## Contrato e arquivos gerados

- Alterações HTTP exigem `pnpm contracts:generate` na raiz e revisão do diff gerado.
- Não edite `packages/contracts/openapi/openapi.json` nem
  `packages/contracts/src/generated/` manualmente.
- Não edite `packages/database/src/generated/prisma/`; regenere pela raiz.

## Testes e comandos locais

```bash
pnpm --filter @sistema-erp/api test
pnpm --filter @sistema-erp/api typecheck
pnpm --filter @sistema-erp/api build
pnpm --filter @sistema-erp/api openapi:export
pnpm --filter @sistema-erp/api nfe:validate -- <arquivo-ou-diretório>
```

- Testes HTTP usam a aplicação Nest/Fastify real com `inject`.
- Fixtures fiscais são sintéticas; nunca copie XML de produção para o repositório.
- Para o contrato S3 opt-in, use `pnpm test:s3:integration` com o ambiente local documentado.
