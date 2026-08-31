# Política de atualização de dependências

## Automação

O Dependabot verifica semanalmente as dependências do workspace pnpm e mensalmente as GitHub
Actions. Atualizações minor e patch são agrupadas por tipo de dependência para limitar ruído. Versões
major permanecem separadas porque exigem análise de migração.

## Critérios de revisão

- Mantenha versões exatas e um único `pnpm-lock.yaml`.
- Revise changelog, compatibilidade com Node.js e riscos de segurança antes do merge.
- Não faça merge automático. Toda atualização deve passar pelo workflow de CI.
- Para versões major, registre uma ADR quando a mudança alterar arquitetura, contrato ou operação.
- Dependências novas precisam justificar necessidade, manutenção e a ausência de alternativa nativa.

## Rotina manual

Use `pnpm outdated --recursive` para a revisão periódica. Depois de atualizar, execute
`pnpm install`, revise o lockfile e valide com `pnpm verify` e `pnpm test:e2e`. Quando a atualização
afetar o Playwright, reinstale o navegador com `pnpm test:e2e:install`.
