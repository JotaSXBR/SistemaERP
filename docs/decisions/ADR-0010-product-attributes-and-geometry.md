# ADR-0010 — Atributos técnicos e geometria do produto

- Status: proposto
- Data: 2026-09-04

## Contexto

A ADR-0008 decidiu o bloco de **classificação comercial** (categoria hierárquica e marca) e
declarou explicitamente que geometria ficaria para um ADR próprio, "porque tem atributos numéricos
esparsos com unidade". Este é esse ADR, e ele também resolve a tensão registrada em
`ai-handoff.md` entre taxonomia hierárquica e a classificação por eixos ortogonais do legado.

O questionário respondido pelo proprietário em 2026-09-04 (`docs/product/steel-distribution-domain.md`)
resolveu as duas incógnitas que travavam a modelagem:

1. **Os eixos de classificação variam por linha de produto.** Aço carbono tem liga e processo;
   alumínio tem liga e têmpera; tubo tem schedule; bronze tem composição. Não são três eixos fixos,
   e novos eixos devem poder ser criados por usuários com permissão, sem alteração de sistema.
2. **A medida entra em cálculo.** O preço sai de `comprimento × peso/m × preço/kg`, com o peso
   teórico por metro como base. Milímetro e polegada precisam conviver como representações
   equivalentes do mesmo valor.

O `phase-8` já impunha a restrição que orienta toda a decisão abaixo:

> Nem todo produto terá todos os atributos. Não se deve criar uma coluna genérica de texto para
> informações usadas em cálculo, nem preencher medidas inexistentes com zero.

## Decisão

### Dois mecanismos distintos, separados pelo uso

A regra que separa os dois é **se o valor entra em cálculo**:

| Natureza do atributo                               | Mecanismo      | Exemplos                                      |
| -------------------------------------------------- | -------------- | --------------------------------------------- |
| Enumeração controlada, usada para agrupar e buscar | Faceta tipada  | liga, processo, têmpera, schedule, acabamento |
| Número com unidade, usado em cálculo               | Coluna própria | espessura, diâmetro, comprimento, peso/m      |

Facetas nunca entram em conta. Geometria nunca é texto livre. Um atributo que precise das duas
coisas está mal definido e deve ser dividido.

### Facetas tipadas ao lado da taxonomia, não no lugar dela

Duas tabelas novas, ambas escopadas por organização:

- `ProductAttributeDefinition` — o eixo (`code` imutável, `name`, `active`). "Liga", "Processo",
  "Schedule".
- `ProductAttributeOption` — os valores permitidos de um eixo (`code` imutável, `name`, `active`).
  "SAE 1020", "Trefilado", "40".

O produto se liga às opções por uma tabela de junção. Um produto tem zero ou mais facetas, e no
máximo uma opção por eixo — a restrição é `(product_id, definition_id)` única.

A alternativa de acrescentar colunas fixas (`ligaId`, `processoId`, `scheduleId`) foi recusada pelo
mesmo motivo que a ADR-0008 recusou dimensões planas: fixa os eixos no schema, e migrations aqui
são imutáveis. Criar o eixo "Têmpera" viraria migration em vez de cadastro.

**A ADR-0008 permanece válida e intocada.** Categoria hierárquica e marca continuam como estão e
resolvem o agrupamento comercial (família, grupo comercial, fabricante). As facetas resolvem a
descrição técnica, que é ortogonal: um vergalhão pode ser 1020 ou 1045, e um 1020 pode ser
vergalhão ou chapa. São dois problemas diferentes com duas soluções diferentes, exatamente como o
`phase-8` já os separava em duas linhas distintas.

### Geometria em colunas próprias, nulas quando não se aplicam

Atributos numéricos ganham colunas `numeric` nulas no produto, nunca zero como sentinela:
espessura, largura, altura, diâmetro externo, diâmetro interno, comprimento, peso por metro e peso
por metro quadrado.

São poucas, conhecidas e estáveis — a lista vem do `phase-8`, não de especulação. Guardá-las como
pares chave/valor genéricos tornaria impossível impor tipo, precisão e unidade, e todo cálculo
precisaria converter texto antes de multiplicar. Nulo significa "não se aplica a este produto",
que é diferente de zero.

### Milímetro é a unidade canônica

Toda dimensão é persistida em **milímetro**, como `numeric` exato. Polegada é apresentação,
convertida na interface nos dois sentidos, nunca uma segunda coluna.

Guardar as duas representações criaria a possibilidade de elas divergirem, e não existe fonte de
verdade entre duas colunas que deveriam concordar. A conversão é exata e conhecida
(1″ = 25,4 mm), então nada se perde ao derivá-la.

O mesmo vale para as escalas próprias do setor: "chapa 11" é um rótulo comercial de 3,18 mm, e
pertence a uma faceta, enquanto 3,18 mm é o que vai na coluna de espessura.

### Peso teórico é dado do produto, não cálculo do sistema

`pesoPorMetro` e `pesoPorMetroQuadrado` são informados no cadastro, vindos das tabelas do
fornecedor que o proprietário já usa. O sistema **não deriva peso a partir de densidade e
geometria**.

O `phase-8` autoriza fórmula de conversão "somente quando tecnicamente validada", e não há
validação dessas fórmulas por engenharia aqui. Um peso calculado errado vira preço errado
silenciosamente. Enquanto a fórmula não for confirmada, o número informado é a autoridade.

## Consequências

- Criar um eixo novo passa a ser cadastro, não migration.
- O preço de venda por corte (`comprimento × peso/m × preço/kg`) passa a ter todos os seus insumos
  no catálogo. **O cálculo em si não pertence a este ADR** — venda e precificação são recorte
  próprio, e este ADR só garante que os dados existem.
- Consultas por faceta sobem um índice na junção; a busca combinada por várias facetas é
  interseção, e precisa ser medida antes de virar filtro na listagem.
- Importar os ~5.800 itens do legado exige mapear a descrição concatenada para facetas e medidas.
  Isso é trabalho de importação, com recorte próprio, e não deve contaminar o cadastro manual.
- Facetas são opcionais. Produtos importados sem classificação continuam válidos e podem ser
  organizados depois, o que o proprietário indicou ser necessário.
- Não há identidade de lote em nenhuma das duas estruturas. Rastreabilidade por corrida está fora
  de escopo por decisão do proprietário (`steel-distribution-domain.md`) e exigiria um recorte
  próprio, provavelmente caro.

## Alternativas recusadas

**EAV genérico para tudo.** Uma tabela `atributo/valor` cobrindo facetas e geometria junto. Recusada
porque o `phase-8` proíbe explicitamente coluna genérica de texto para informação usada em cálculo,
e porque perde tipo, precisão e unidade justamente onde eles importam.

**Substituir a taxonomia por facetas.** Descartar a ADR-0008 e modelar tudo como eixos. Recusada
porque a hierarquia continua sendo o mecanismo certo para família e grupo comercial, e porque
decisões aceitas não são silenciosamente revertidas — precisariam de um ADR que as revisasse com
justificativa própria.

**Guardar medida como texto, do jeito que o legado guarda.** Recusada porque a resposta B1 mostrou
que a medida entra em cálculo. Texto obrigaria a converter antes de toda conta, e `12"`, `12 pol` e
`304,8` conviveriam como valores distintos do mesmo número.
