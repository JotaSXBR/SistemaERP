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
