# Regras de `apps/web`

Este arquivo complementa o `AGENTS.md` da raiz. Siga também
`docs/conventions/frontend.md` e `docs/conventions/testing.md`.

## Arquitetura

- Organize código em `app/`, `features/`, `pages/` e `shared/` conforme a responsabilidade.
- Estado remoto pertence ao TanStack Query; mantenha estado local próximo do componente.
- Não copie respostas da API para store global sem necessidade demonstrável.
- Acesso HTTP usa exclusivamente o cliente de `@sistema-erp/contracts`; não espalhe URLs ou tipos
  internos da API pela aplicação.
- Formulários usam React Hook Form e Zod. A API continua sendo a autoridade de validação.
- Não converta valores monetários para ponto flutuante para cálculos.

## Interface

- Componentes base não conhecem regras de negócio; componentes de feature podem orquestrar fluxos.
- Inclua labels, navegação por teclado e foco coerente.
- Trate estados de carregamento, vazio, erro, sucesso e permissão negada.
- Reutilize os tokens Tailwind existentes antes de criar padrões visuais novos.
- Sessão e cache devem preservar isolamento entre organizações.

## Contrato e arquivos gerados

- Importe DTOs e operações do cliente gerado; não replique o contrato manualmente.
- Não edite `packages/contracts/src/generated/` ou `packages/contracts/openapi/openapi.json`.
- Quando a API mudar, regenere o contrato na raiz antes de adaptar a interface.

## Testes e comandos locais

```bash
pnpm --filter @sistema-erp/web test
pnpm --filter @sistema-erp/web typecheck
pnpm --filter @sistema-erp/web build
pnpm --filter @sistema-erp/web test:e2e
```

- Vitest cobre componentes e fluxos locais; Playwright fica para poucos caminhos críticos.
- Teste comportamento observável e acessibilidade, não detalhes internos do componente.
- E2E requer PostgreSQL e migrations; consulte `docs/development/setup.md`.
