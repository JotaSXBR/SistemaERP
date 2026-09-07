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

## CI e validação local

- O workflow `CI` roda em PRs e na `main`, em runners padrão Ubuntu. Repositórios públicos não consomem a franquia de minutos dos repositórios privados do GitHub Free.
- `Commit validation` mantém o check obrigatório `Validate commits` separado e também reage à edição do título do PR. Editar o título não repete os testes. A proteção da `main` deve continuar exigindo `Validate commits`, `Scan secrets` e `Validate workspace`, além do CodeQL.
- Alterações exclusivamente Markdown executam `git diff --check` e Prettier nos arquivos adicionados ou modificados. Os demais arquivos selecionam a validação completa.
- O CI gera o cliente Prisma uma vez antes de executar `lint:prepared`, `typecheck:prepared`, `test:prepared` e `build:prepared`. Esses comandos pressupõem `pnpm db:generate`; os comandos locais sem o sufixo continuam preparando o cliente automaticamente.
- A validação completa provisiona MinIO privado e versionado pelo Compose e executa `pnpm test:s3:integration`. As credenciais são sintéticas e o serviço é descartável, sem contas externas.
- Playwright cobre diagnóstico, login/logout, persistência do produto e ingestão/reimportação de XML sintético. A API e o PostgreSQL são reais; em `NODE_ENV=test`, o storage da API permanece em memória. O contrato S3 é verificado separadamente contra MinIO.
- Cada tentativa de E2E cria usuário e organização exclusivos, sem seed compartilhado. Execute com `NODE_ENV=test`, `DATABASE_URL` apontando para um banco descartável e migrations aplicadas. Os registros sintéticos e sua auditoria permanecem nesse banco até ele ser descartado; os testes não desabilitam triggers nem apagam dados de outras organizações.
- No CI, uma única repetição do Playwright coleta trace para diagnóstico; um teste que só passa na repetição ainda reprova o job (`failOnFlakyTests`). Os relatórios permanecem disponíveis por sete dias.

Para reproduzir a validação funcional, execute `pnpm verify`, `pnpm test:s3:integration` com MinIO configurado e `pnpm test:e2e` com Chromium instalado. `pnpm verify` sozinho não inclui MinIO nem Playwright.
