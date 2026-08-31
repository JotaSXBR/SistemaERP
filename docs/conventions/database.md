# Convenções de banco de dados

## Nomenclatura e chaves

- Identificadores públicos usam UUID ou UUIDv7 quando suportado pela decisão de implementação.
- Tabelas de negócio multiempresa possuem `organizationId` obrigatório.
- Índices e unicidade consideram o tenant.
- Chaves estrangeiras e comportamento de exclusão são explícitos.
- Nomes no código permanecem em inglês.

## Tipos

- Dinheiro: `numeric` com precisão e escala documentadas.
- Instante: timestamp com timezone, normalizado em UTC.
- Data civil: `date`.
- Quantidades: decimal quando puderem ser fracionárias.
- JSON somente para dados realmente sem schema relacional estável.

## Migrations

1. Gere a migration em desenvolvimento.
2. Revise o SQL produzido.
3. Avalie locks, defaults e tabelas grandes.
4. Execute em banco limpo e em banco com schema anterior.
5. Versione migration e schema juntos.

Migrations de produção não devem depender de comandos interativos. Backfills volumosos não devem ficar escondidos em uma migration bloqueante.

## Exclusão e auditoria

Soft delete não é padrão universal. Use apenas quando houver requisito de restauração ou retenção. Auditoria não substitui constraints e integridade relacional.

## pgvector

Antes de habilitar, documente modelo de embedding, dimensão, distância, estratégia de atualização e isolamento por tenant. Comece com busca exata; adicione HNSW/IVFFlat após medir volume, latência e recall.
