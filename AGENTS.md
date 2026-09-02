# Instruções para agentes de IA

## Missão

Implementar o ERP respeitando a documentação em `docs/`. Não invente arquitetura local que contradiga uma decisão registrada.

## Antes de alterar código

1. Leia `docs/architecture/overview.md` e o documento de convenções da camada afetada.
2. Verifique decisões em `docs/decisions/`.
3. Inspecione o código existente antes de propor novos padrões.
4. Declare qualquer suposição que afete domínio, segurança, tenant, dinheiro ou auditoria.

## Regras obrigatórias

- Preserve o monólito modular; não crie microsserviços sem ADR aprovado.
- Não adicione dependências sem justificar necessidade, manutenção e alternativa nativa.
- Toda entidade de negócio multiempresa deve ser vinculada a `organizationId`.
- Nunca aceite `organizationId` do corpo como fonte de autorização; derive-o do contexto autenticado.
- Dinheiro usa decimal no código e `numeric` no PostgreSQL; nunca `float`.
- Instantes são persistidos em UTC; datas civis usam o tipo de data apropriado.
- Mudanças relevantes devem produzir auditoria estruturada.
- Operações reexecutáveis ou externas devem ser idempotentes.
- Não edite manualmente clientes, schemas ou artefatos gerados.
- Migrations são imutáveis depois de aplicadas em ambiente compartilhado.
- IA nunca grava dados críticos sem validação determinística, autorização e auditoria.

## Critério de conclusão

Uma mudança só está concluída quando:

- compila com TypeScript strict;
- passa em formatação, lint, typecheck e testes pertinentes;
- inclui migrations e testes quando necessários;
- atualiza OpenAPI e cliente gerado quando o contrato muda;
- atualiza documentação ou ADR quando introduz uma decisão;
- não contém segredos, dados pessoais reais ou logs sensíveis;
- informa claramente o que foi validado e o que não pôde ser validado.

Use validação proporcional ao risco:

- docs-only: `pnpm exec prettier --check <arquivos>` e `git diff --check`;
- código localizado: formatação, lint, typecheck e testes diretamente afetados;
- execute `pnpm verify` para migrations, contrato HTTP, autenticação/tenant, parser fiscal, upload,
  dependências ou mudanças transversais.

Não repita a suíte completa sem mudança material desde a última execução aprovada.

## GitHub (agente)

### Quando usar Issues / PRs

- **Issue pequena** = 1 entrega testável → idealmente **1 branch / 1 PR**.
- **Epic** = incremento de fase (ex.: 8.2), só com links para issues filhas e para o doc de produto. Não implementar “o epic inteiro” num PR.
- Não criar issue para typo, refactor local ou chore trivial — commit direto (ou PR único sem issue) se o humano pedir.
- Não abrir issue/PR só para documentar o que o handoff já diz.

### Fluxo padrão de feature

1. Ler issue (se houver) + `docs/development/ai-handoff.md` + doc da fase.
2. Branch curta: `feat/<slug>`, `fix/<slug>`, `docs/<slug>`, `chore/<slug>`.
3. Implementar **só o escopo da issue/pedido**.
4. `pnpm verify` (ou o subconjunto pertinente) antes de abrir PR.
5. PR contra `main`, título em Conventional Commits, body curto.
6. Na descrição do PR: o que mudou, como validou, o que **não** validou. `Closes #N` se houver issue.
7. Não mergear na `main` sem o humano pedir (exceto se a regra do projeto disser o contrário).

### CI remoto

- Depois de abrir ou atualizar um PR, informe o link e continue ou devolva o controle ao humano; não
  espere ativamente o workflow terminar.
- Não use `gh pr checks --watch`. Consulte o resultado uma vez somente se o humano pedir, se houver
  indicação de falha ou imediatamente antes de uma operação que dependa do CI verde.
- PRs apenas com Markdown recebem somente a validação leve do workflow. A suíte completa fica para
  mudanças de código, configuração executável, dependências, migrations ou artefatos gerados.
- Uma falha remota deve ser investigada pelo trecho relevante do log; sucesso local recente não
  precisa ser repetido antes de entender a divergência.

### Commits

- Conventional Commits: `feat|fix|refactor|docs|test|chore|ci(scope): descrição`.
- 1 ideia por commit quando possível; sem “Generated with …” / co-author de bot a menos que o humano peça.
- Nunca commit de segredo, `.env`, XML real, `files/`, `.local-data/`.

### Uso de `gh` (economizar tokens)

- Preferir **`gh`** a listar dumps grandes da API/MCP.
- **Um** snapshot de estado por tarefa, não reconsultar a cada passo:
  - `gh issue view N --json title,body,labels,state`
  - `gh pr view --json number,title,state,url`
  - `git diff --stat` e só depois diff dos arquivos relevantes
- Listagens com limite: `gh issue list -L 10`, `gh pr list -L 10`.
- Corpo de issue/PR multi-linha: escrever em arquivo temporário e usar `--body-file` (não `--body` com markdown enorme no shell).
- Comentários no GitHub: só se o humano pedir; curtos e técnicos.
- Não paginar o histórico inteiro do repo; não baixar todos os PRs/issues “por precaução”.

### O que o agente NÃO faz no GitHub

- Não força push (`--force`) na `main` nem em branch compartilhada.
- Não fecha issues de outras pessoas; deixa o merge com `Closes #N` fechar.
- Não cria labels/milestones/projects novos sem pedido.
- Não roda workflows agentic em loop (triage, review automático em massa) neste repo solo.
- Não cola diff inteiro nem log de CI inteiro no contexto; resume falhas (`tail`, `grep FAIL`, `--stat`).

### Tamanho do PR

- Preferir PR revisável em poucos minutos.
- Schema/migration, auth/tenant, parser fiscal e upload: PR separado e descrito com risco.
- Docs-only e test-only podem ser PRs menores e mais rápidos.
