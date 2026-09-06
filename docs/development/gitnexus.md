# GitNexus — Code Intelligence

Este projeto é indexado pelo GitNexus como **SistemaERP**. As estatísticas do índice (símbolos,
relacionamentos, fluxos) são geradas pela ferramenta no momento da análise; consulte
`node .gitnexus/run.cjs status` (ou o recurso `gitnexus://repo/SistemaERP/context`) para os valores
atuais em vez de confiar em números escritos em documentação.

> Índice desatualizado? Rode `node .gitnexus/run.cjs analyze --index-only` a partir da raiz do
> projeto — ele seleciona automaticamente um runner disponível. Ainda não existe
> `.gitnexus/run.cjs`? Faça o bootstrap com `npx`, `bunx` ou `pnpm dlx` — ex.:
> `bunx gitnexus@latest analyze` (bug do npm 11 com npx; #1939).

## Escopo de aplicação

As obrigações abaixo valem para **mudanças em código de produção** (apps, packages, migrations,
contratos). **Mudanças apenas de documentação ou configuração trivial** (CHANGELOG, README, docs
em `docs/`, ajustes de formatação) são **isentas** de análise de impacto e de mudanças no grafo,
alinhado à validação proporcional do `AGENTS.md`.

## Recomendado / Obrigatório

- **Obrigatório (código de produção): rode análise de impacto antes de editar.** Use
  `impact({target: "symbolName", direction: "upstream"})` (MCP) ou
  `node .gitnexus/run.cjs impact "symbolName" --direction upstream --repo .` (fallback CLI);
  relate callers, processos e risco. Não substitua análise de grafo por grep quando o índice
  estiver disponível.
- **Obrigatório (código de produção): analise as mudanças no grafo antes de commitar.** Use
  `detect_changes({scope: "all"})` (MCP) ou
  `node .gitnexus/run.cjs detect-changes --scope all --repo .` (fallback CLI). `partial: true`
  ou `truncated: true` não é verificação limpa — um zero significa "não visto", não "não
  afetado"; rode novamente. Para revisão de regressão:
  `detect_changes({scope: "compare", base_ref: "main"})` ou
  `node .gitnexus/run.cjs detect-changes --scope compare --base-ref "main" --repo .`.
- **Avise o usuário** se a análise de impacto retornar risco HIGH ou CRITICAL antes de prosseguir
  com as edições.
- **Trate `risk: UNKNOWN` como não resolvido, não como baixo.** Um conjunto vazio de callers não é
  evidência de que o símbolo é não usado — também pode significar que os callers não são
  resolvíveis pelo índice (acesso via propriedade de objeto simples, dispatch dinâmico, chamadas
  entre linguagens). `impact` acompanha `UNKNOWN` com um `riskNote` explicando isso. Confirme com
  busca textual antes de tratar o símbolo como seguro para alterar ou remover; não prossiga
  baseado apenas no zero.
- Ao explorar código desconhecido, use `query({search_query: "concept"})` para encontrar fluxos de
  execução em vez de grep. Ele retorna resultados agrupados por processo, ordenados por relevância.
- Quando precisar de contexto completo sobre um símbolo específico — callers, callees, em quais
  fluxos de execução ele participa — use `context({name: "symbolName"})`.
- Para revisão de segurança, `explain({target: "fileOrSymbol"})` lista achados de taint (fluxos
  source→sink; requer `analyze --pdg`).

## Evite

- Não edite uma função, classe ou método de produção sem antes fazer análise de impacto via
  MCP/CLI, quando o índice estiver disponível.
- Não ignore avisos de risco HIGH ou CRITICAL da análise de impacto, e nunca leia `UNKNOWN` como
  "tudo certo" — significa que a análise não conseguiu responder, o único veredito que exige
  confirmação por outros meios.
- Não renomeie símbolos com find-and-replace — use `rename`, que entende o grafo de chamadas.
- Não commite mudanças de código de produção antes da análise de mudanças no grafo (quando o
  índice estiver disponível).

## Recursos

| Resource                                    | Use for                                           |
| ------------------------------------------- | ------------------------------------------------- |
| `gitnexus://repo/SistemaERP/context`        | Visão geral do codebase, checar frescor do índice |
| `gitnexus://repo/SistemaERP/clusters`       | Todas as áreas funcionais                         |
| `gitnexus://repo/SistemaERP/processes`      | Todos os fluxos de execução                       |
| `gitnexus://repo/SistemaERP/process/{name}` | Traço passo a passo de execução                   |

## CLI

| Tarefa                                       | Leia este arquivo de skill                         |
| -------------------------------------------- | -------------------------------------------------- |
| Entender arquitetura / "Como X funciona?"    | `.claude/skills/gitnexus-exploring/SKILL.md`       |
| Blast radius / "O que quebra se eu mudar X?" | `.claude/skills/gitnexus-impact-analysis/SKILL.md` |
| Rastrear bugs / "Por que X está falhando?"   | `.claude/skills/gitnexus-debugging/SKILL.md`       |
| Renomear / extrair / dividir / refatorar     | `.claude/skills/gitnexus-refactoring/SKILL.md`     |
| Referência de ferramentas, recursos e schema | `.claude/skills/gitnexus-guide/SKILL.md`           |
| Comandos CLI: index, status, clean, wiki     | `.claude/skills/gitnexus-cli/SKILL.md`             |
