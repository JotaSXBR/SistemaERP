# Sistema ERP

Blueprint técnico para um ERP web, multiempresa e preparado para recursos assistidos por IA.

O projeto será desenvolvido por uma pessoa com apoio intensivo de agentes de IA. Por isso, a fundação prioriza convenções explícitas, arquitetura previsível, validação automatizada e baixo custo operacional.

## Estado atual

As Fases 1 a 5 disponibilizam o workspace pnpm, PostgreSQL local, persistência com Prisma, API NestJS/Fastify e a aplicação React/Vite. O frontend usa roteamento, TanStack Query, Tailwind CSS e um SDK TypeScript gerado do OpenAPI. A próxima etapa é a Fase 6 (qualidade e entrega), seguindo a ordem definida em [Fundação](docs/architecture/foundation.md).

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

Use `pnpm infra:status`, `pnpm infra:logs` e `pnpm infra:down` para operar o PostgreSQL local. O schema Prisma ainda não possui entidades de domínio; elas serão adicionadas junto das primitivas de plataforma.

Com API e web em execução, acesse `http://localhost:5173/diagnostics`. Quando o contrato HTTP mudar, execute `pnpm contracts:generate` para exportar o OpenAPI e regerar o SDK em `packages/contracts`.

## Documentos principais

- [Visão arquitetural](docs/architecture/overview.md)
- [Fundação e sequência de implementação](docs/architecture/foundation.md)
- [Ambiente de desenvolvimento](docs/development/setup.md)
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
