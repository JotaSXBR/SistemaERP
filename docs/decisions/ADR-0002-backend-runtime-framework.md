# ADR-0002 — Node.js, NestJS e Fastify

- Status: Aceita
- Data: 2026-08-28

## Contexto

O backend exige convenções fortes, ecossistema estável e compatibilidade ampla. Desempenho bruto não é o principal gargalo previsto.

## Decisão

Usar a versão Active LTS do Node.js, NestJS e o adapter Fastify. Usar pnpm para pacotes e workspaces. A versão exata será fixada no repositório e atualizada de forma deliberada.

## Consequências

Há mais estrutura que em frameworks minimalistas, mas controllers, providers, guards e módulos ficam previsíveis para manutenção humana e por IA. Bun e Elysia podem ser reavaliados em outro contexto, mas não compõem o runtime inicial.

