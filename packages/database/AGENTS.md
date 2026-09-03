# Regras de `packages/database`

Este arquivo complementa o `AGENTS.md` da raiz. As regras normativas estão em
`docs/conventions/database.md`, `docs/conventions/testing.md` e ADR-0003.

## Responsabilidade

- PostgreSQL é a fonte de verdade; Prisma define schema, migrations e acesso tipado.
- Este pacote contém persistência, não utilitários genéricos de domínio.
- Tabelas de negócio multiempresa têm `organizationId`, relações e constraints compatíveis com o
  isolamento por tenant.
- Use `numeric` para dinheiro e quantidades exatas, `timestamptz` para instantes UTC e `date` para
  datas civis.
- Chaves estrangeiras, exclusão, índices e unicidade devem ser explícitos.

## Migrations

- Gere migrations em desenvolvimento, revise o SQL e avalie locks, defaults e volume.
- Teste banco limpo e atualização a partir do schema anterior quando houver risco.
- Nunca altere migration aplicada em ambiente compartilhado; adicione outra.
- Backfills relevantes são scripts explícitos e observáveis, não operações ocultas em migrations
  bloqueantes.
- Ambientes compartilhados usam `db:migrate:deploy`, nunca migration interativa.

## Arquivos gerados

- `src/generated/prisma/` é gerado por Prisma e não deve ser editado manualmente.
- Exporte apenas a superfície necessária por `src/index.ts`.
- Depois de mudar o schema, execute a geração antes de typecheck ou testes.

## Testes e comandos locais

```bash
pnpm --filter @sistema-erp/database db:generate
pnpm --filter @sistema-erp/database db:migrate
pnpm --filter @sistema-erp/database db:migrate:deploy
pnpm --filter @sistema-erp/database db:migrate:status
pnpm --filter @sistema-erp/database test
pnpm --filter @sistema-erp/database typecheck
pnpm --filter @sistema-erp/database build
```

- Testes de persistência usam PostgreSQL real e as mesmas migrations dos demais ambientes.
- Fixtures e seeds usam somente identidades sintéticas e nunca credenciais reutilizáveis.
