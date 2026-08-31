# Sistema ERP

Blueprint técnico para um ERP web, multiempresa e preparado para recursos assistidos por IA.

O projeto será desenvolvido por uma pessoa com apoio intensivo de agentes de IA. Por isso, a fundação prioriza convenções explícitas, arquitetura previsível, validação automatizada e baixo custo operacional.

## Estado atual

Este repositório contém inicialmente apenas a documentação da fundação. A implementação deve seguir a ordem definida em [Fundação](docs/architecture/foundation.md).

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

