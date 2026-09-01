# Fundação e sequência de implementação

## Definição de fundação concluída

A fundação está pronta quando um desenvolvedor consegue clonar o repositório, iniciar o ambiente, aplicar migrations, executar API e web e validar tudo com comandos documentados; a CI repete o mesmo processo sem passos manuais.

## Fase 1 — Workspace

- pnpm workspace e lockfile único;
- TypeScript strict;
- configurações compartilhadas de lint e formatação;
- scripts raiz uniformes;
- política de variáveis de ambiente;
- `pnpm verify`.

## Fase 2 — Infraestrutura local

- Docker Compose com PostgreSQL;
- health check do banco;
- volumes nomeados;
- `.env.example` sem segredos;
- comandos de subida, descida e inspeção.

## Fase 3 — Persistência

- pacote `database`;
- Prisma configurado com saída explícita do client;
- migration inicial;
- seed idempotente apenas para desenvolvimento;
- teste de integração com PostgreSQL real.

## Fase 4 — API

- NestJS com adapter Fastify;
- configuração validada no bootstrap;
- endpoint de saúde e readiness;
- formato único de erros;
- logging estruturado;
- contexto da requisição;
- documentação OpenAPI.

## Fase 5 — Web

- React, Vite e Tailwind;
- roteamento;
- TanStack Query;
- layout base e tratamento global de erros;
- cliente de API gerado a partir de OpenAPI;
- página de diagnóstico consumindo a API.

## Fase 6 — Qualidade e entrega

- [x] testes unitários e de integração com Vitest;
- [x] fluxo mínimo E2E com Playwright;
- [x] CI para install, lint, typecheck, migrations, testes e build;
- [x] checagem de divergência de artefatos gerados;
- [x] política de atualização de dependências.

## Fase 7 — Primitivas de plataforma

Documentação consolidada da implementação: [Fase 7 — Primitivas de plataforma](phase-7-platform-primitives.md).

- [x] identidade e sessão;
- [x] organizações e memberships;
- [x] RBAC;
- [x] auditoria;
- [x] idempotência;
- [x] isolamento de tenant testado.

## Fora da fundação inicial

- microsserviços;
- Kubernetes;
- event sourcing;
- CQRS generalizado;
- Redis e filas sem job real;
- S3/MinIO sem upload real;
- pgvector sem corpus e consulta definidos;
- LangGraph sem workflow persistente;
- dashboards próprios de observabilidade antes de telemetria útil.

## Gate para a primeira funcionalidade

Nenhum módulo funcional deve começar antes de: CI verde, migration reproduzível, contrato API gerado, teste E2E mínimo e contexto de tenant disponível.

O gate foi atendido pelas fases 1 a 7. O desenvolvimento funcional segue o
[roteiro do produto](../product/README.md), começando pela
[Fase 8 — Catálogo, entrada fiscal e estoque rastreável](../product/phase-8-receiving-inventory.md).
