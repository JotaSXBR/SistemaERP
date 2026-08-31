# ADR-0003 — PostgreSQL e Prisma

- Status: Aceita
- Data: 2026-08-28

## Decisão

PostgreSQL será a fonte de verdade transacional. Prisma será usado para schema, migrations e acesso tipado. SQL parametrizado é permitido quando o ORM não expressar uma consulta adequadamente, sempre encapsulado no pacote de banco.

## Regras

- migrations aplicadas são imutáveis;
- produção usa o comando de deploy de migrations, nunca migration de desenvolvimento;
- alterações de dados e backfills têm scripts explícitos e observáveis;
- tipos monetários usam `numeric`;
- extensões como pgvector são adicionadas por migration somente quando necessárias.

