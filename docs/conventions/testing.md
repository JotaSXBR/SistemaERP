# Estratégia de testes

## Pirâmide pragmática

- Unitários: regras puras e transformações.
- Integração: módulos com PostgreSQL real e adaptadores externos simulados nas fronteiras.
- E2E de API: aplicação Nest/Fastify real com `inject`.
- E2E web: poucos fluxos críticos no Playwright.

## Regras

- Teste comportamento observável, não detalhes privados.
- Cada correção de bug deve incluir teste de regressão quando reproduzível.
- Isolamento de tenant precisa de testes negativos: dados de outra organização nunca aparecem.
- Dinheiro, arredondamento, timezone, autorização e idempotência exigem casos de borda.
- Testes não dependem da ordem de execução.
- Fixtures usam dados sintéticos e mínimos.

## Banco

Testes de persistência usam PostgreSQL real, não SQLite como substituto. O schema deve ser criado pelas mesmas migrations utilizadas fora dos testes.

## Pipeline mínimo

```text
format check -> lint -> typecheck -> unit/integration -> build -> e2e
```

Falhas não podem ser ignoradas para permitir merge. Testes instáveis devem ser corrigidos ou removidos com justificativa, nunca apenas repetidos indefinidamente.
