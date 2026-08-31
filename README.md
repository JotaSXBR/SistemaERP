# Sistema ERP

Blueprint técnico para um ERP web, multiempresa e preparado para recursos assistidos por IA.

O projeto será desenvolvido por uma pessoa com apoio intensivo de agentes de IA. Por isso, a fundação prioriza convenções explícitas, arquitetura previsível, validação automatizada e baixo custo operacional.

## Estado atual

As Fases 1 a 7 disponibilizam a fundação técnica completa: workspace pnpm, PostgreSQL/Prisma, API NestJS/Fastify, aplicação React/Vite, esteira de qualidade, identidade e sessão, organizações e memberships, RBAC, auditoria imutável, idempotência e isolamento de tenant testado. O gate para a primeira funcionalidade do ERP está liberado, seguindo os critérios definidos em [Fundação](docs/architecture/foundation.md).

## Início rápido

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm infra:up
pnpm db:migrate:deploy
pnpm db:seed
pnpm verify
```

Use `pnpm infra:status`, `pnpm infra:logs` e `pnpm infra:down` para operar o PostgreSQL local. O seed cria a organização `demo` e o usuário sintético `admin@example.test` para desenvolvimento local.

Com API e web em execução, acesse `http://localhost:5173/diagnostics`. Quando o contrato HTTP mudar, execute `pnpm contracts:generate` para exportar o OpenAPI e regerar o SDK em `packages/contracts`.

## Documentos principais

- [Visão arquitetural](docs/architecture/overview.md)
- [Fundação e sequência de implementação](docs/architecture/foundation.md)
- [Ambiente de desenvolvimento](docs/development/setup.md)
- [Política de atualização de dependências](docs/development/dependency-updates.md)
- [Convenções de backend](docs/conventions/backend.md)
- [Convenções de frontend](docs/conventions/frontend.md)
- [Convenções de banco de dados](docs/conventions/database.md)
- [Estratégia de testes](docs/conventions/testing.md)
- [Uso de IA no produto](docs/conventions/ai.md)
- [Decisões arquiteturais](docs/decisions/README.md)
- [Instruções para agentes](AGENTS.md)

## Stack aprovada

- Monorepo TypeScript com pnpm workspaces
- React 19, Vite e Tailwind CSS 4
- Node.js Active LTS, NestJS e Fastify
- PostgreSQL e Prisma ORM
- Vitest e Playwright
- Docker Compose para infraestrutura local
- OpenAPI como contrato da API

Redis, BullMQ, armazenamento S3, pgvector, OpenTelemetry, Sentry, Langfuse e LangGraph são capacidades progressivas e só devem ser ativadas quando houver um caso de uso concreto.
