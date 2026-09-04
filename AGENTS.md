# Instruções para agentes de IA

## Missão

Implementar o ERP conforme `docs/`, preservando o monólito modular e as decisões aceitas. Em caso
de conflito, ADRs e documentos de arquitetura prevalecem sobre resumos operacionais.

## Antes de alterar

1. Leia `docs/architecture/overview.md`, `docs/development/ai-handoff.md` e o documento de produto
   aplicável.
2. Consulte `docs/decisions/` e as convenções da área em `docs/conventions/`.
3. Leia o `AGENTS.md` aninhado do workspace afetado e inspecione o código existente.
4. Declare suposições que afetem domínio, segurança, tenant, dinheiro ou auditoria.
5. Confirme `git status` e não sobrescreva mudanças preexistentes.

## Fluxo de trabalho

- Uma issue pequena representa uma entrega testável e, idealmente, uma branch e um PR.
- Epics apenas agrupam issues filhas; não implemente um epic inteiro em um único PR.
- Use branches curtas: `feat/<slug>`, `fix/<slug>`, `docs/<slug>` ou `chore/<slug>`.
- Implemente somente o escopo pedido. Mudanças de arquitetura exigem ADR novo ou substituto.
- Prefira um PR revisável em poucos minutos. Separe schema/migration, auth/tenant, parser fiscal e
  upload quando envolverem risco próprio.
- Abra PR contra `main`, descrevendo mudanças, validações e o que não foi validado. Use `Closes #N`
  quando houver issue.
- Não faça merge em `main` sem pedido humano.

## Regras obrigatórias

- Preserve o monólito modular e as fronteiras entre módulos.
- Entidades multiempresa carregam `organizationId`; autorização deriva sempre do contexto
  autenticado, nunca do corpo.
- Dinheiro e quantidades exatas usam decimal no código e `numeric` no PostgreSQL, nunca `float`.
- Instantes são persistidos em UTC; datas civis mantêm tipo e semântica próprios.
- Mudanças relevantes geram auditoria estruturada; operações reexecutáveis ou externas são
  idempotentes.
- IA não grava dados críticos sem validação determinística, autorização e auditoria.
- Não adicione dependências sem justificar necessidade, manutenção e alternativa nativa.

Detalhes por área estão em:

- `docs/conventions/backend.md`
- `docs/conventions/frontend.md`
- `docs/conventions/database.md`
- `docs/conventions/testing.md`
- `docs/conventions/ai.md`

## Commits e GitHub

- Conventional Commits: `feat|fix|refactor|docs|test|chore|ci(scope): descrição`.
- Mantenha uma ideia por commit quando possível; o título do PR também segue o padrão.
- Não inclua assinatura de ferramenta ou coautor de bot sem pedido.
- Não force push em `main` ou branch compartilhada, não feche issue alheia e não crie
  labels/milestones/projects sem pedido.
- Depois de abrir ou atualizar um PR, informe o link; não aguarde o CI continuamente.

## Definition of done

Uma mudança só está concluída quando:

- passa em TypeScript strict, formatação, lint e testes pertinentes;
- inclui testes e migrations quando necessários;
- atualiza OpenAPI e cliente gerado quando o contrato muda;
- atualiza documentação ou ADR quando introduz decisão;
- não contém segredos, dados pessoais reais ou logs sensíveis;
- informa claramente o que foi e não foi validado.

Validação proporcional:

- docs-only: `pnpm exec prettier --check <arquivos>` e `git diff --check`;
- código localizado: formatação, lint, typecheck e testes afetados;
- migrations, contrato HTTP, auth/tenant, parser fiscal, upload, dependências ou mudanças
  transversais: `pnpm verify`.

Não repita a suíte completa sem mudança material. PRs Markdown-only preservam a validação leve do
CI.

## Proibições

- Nunca versione segredos, `.env`, XML real, `files/`, `.local-data/` ou logs sensíveis.
- Nunca edite manualmente cliente Prisma, OpenAPI, SDK ou outro artefato gerado.
- Nunca altere migration já aplicada em ambiente compartilhado; crie uma nova migration.
- Não use dados pessoais reais em fixtures, seeds, documentação ou prompts.

## Comandos essenciais

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm verify
pnpm contracts:check
```

<!-- gitnexus:start -->

# GitNexus — Code Intelligence

This project is indexed by GitNexus as **SistemaERP** (3460 symbols, 6529 relationships, 197 execution flows).

> Index stale? Run `node .gitnexus/run.cjs analyze --index-only` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? Bootstrap with `npx`, `bunx`, or `pnpm dlx` — e.g. `bunx gitnexus@latest analyze` (npm 11 npx crash; #1939).

## Always Do

- **MUST run impact analysis before editing.** Use `impact({target: "symbolName", direction: "upstream"})` (MCP) or `node .gitnexus/run.cjs impact "symbolName" --direction upstream --repo .` (CLI fallback); report callers, processes, and risk. Never substitute grep for graph analysis.
- **MUST analyze graph changes before committing.** Use `detect_changes({scope: "all"})` (MCP) or `node .gitnexus/run.cjs detect-changes --scope all --repo .` (CLI fallback). `partial: true` or `truncated: true` is not a clean check — a zero means unseen, not unaffected; re-run it. For regression review: `detect_changes({scope: "compare", base_ref: "main"})` or `node .gitnexus/run.cjs detect-changes --scope compare --base-ref "main" --repo .`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- **MUST treat `risk: UNKNOWN` as unresolved, not as low.** An empty caller set is not evidence the symbol is unused — it can also mean the callers are not resolvable by the index (plain-object property access, dynamic dispatch, cross-language calls). `impact` pairs `UNKNOWN` with a `riskNote` saying so. Confirm with a text search before treating the symbol as safe to change or delete; do not proceed on the strength of a zero.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method before MCP/CLI impact analysis.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis, and never read `UNKNOWN` as an all-clear — it means the walk could not answer, which is the one verdict that requires confirming by other means.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit before MCP/CLI graph change analysis.

## Resources

| Resource                                    | Use for                                  |
| ------------------------------------------- | ---------------------------------------- |
| `gitnexus://repo/SistemaERP/context`        | Codebase overview, check index freshness |
| `gitnexus://repo/SistemaERP/clusters`       | All functional areas                     |
| `gitnexus://repo/SistemaERP/processes`      | All execution flows                      |
| `gitnexus://repo/SistemaERP/process/{name}` | Step-by-step execution trace             |

## CLI

| Task                                         | Read this skill file                               |
| -------------------------------------------- | -------------------------------------------------- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus-exploring/SKILL.md`       |
| Blast radius / "What breaks if I change X?"  | `.claude/skills/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?"             | `.claude/skills/gitnexus-debugging/SKILL.md`       |
| Rename / extract / split / refactor          | `.claude/skills/gitnexus-refactoring/SKILL.md`     |
| Tools, resources, schema reference           | `.claude/skills/gitnexus-guide/SKILL.md`           |
| Index, status, clean, wiki CLI commands      | `.claude/skills/gitnexus-cli/SKILL.md`             |

<!-- gitnexus:end -->
