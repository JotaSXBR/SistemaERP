# ADR-0004 — OpenAPI como contrato

- Status: Aceita
- Data: 2026-08-28

## Decisão

A API REST produz uma especificação OpenAPI. O frontend utiliza um cliente TypeScript gerado dessa especificação. Tipos internos do NestJS não são importados diretamente pela aplicação web.

## Consequências

Mudanças incompatíveis ficam visíveis, o consumidor não depende da estrutura interna da API e futuros clientes móveis ou integrações podem reutilizar o contrato.
