# Análise dos SKUs das planilhas do proprietário

- Data: 2026-09-04
- Fonte: quatro planilhas do Google Sheets mantidas manualmente pelo proprietário
- Natureza deste documento: **levantamento, não decisão**. O padrão de SKU será decidido em ADR
  própria, e nada aqui foi implementado em código.

## O que foi lido

Quatro planilhas, todas com o mesmo cabeçalho de 23 colunas (a quarta acrescenta `RESISTENCIA` e
`METROS_KG`), somando **419 linhas de produto**:

| Planilha | Linhas | Materiais          |
| -------- | ------ | ------------------ |
| A        | 106    | VC, VND            |
| B        | 108    | SAE 4140, SAE 4340 |
| C        | 107    | SAE 1020, SAE 1045 |
| D        | 98     | AISI 302, AISI 304 |

Colunas: `CODIGO_PRODUTO`, `NIVEL_COMERCIAL`, `TIPO_MATERIAL`, `FORMA`, `TIPO_PRODUTO`, `LARGURA`,
`ESPESSURA`, `LARGURA_MM`, `ESPESSURA_MM`, `COMPRIMENTO_PADRAO_M`, `PESO_KG_M`, `PESO_KG_M2`, `IPI`,
`PRECO_KG`, `PRECO_MT`, `PRECO_PC`, `NCM`, `SINONIMOS`, `USA_FORMULA`, `FORMULA_PRECO_BASE`,
`FORMULA_VALOR_IPI`, `FORMULA_PRECO_TOTAL`, `DESCRICAO`.

**Limitação da leitura**: o conector do Drive entrega o conteúdo das células, e as colunas
`FORMULA_*` guardam a fórmula **como texto digitado numa coluna**, não como fórmula nativa da
célula. Portanto o que foi analisado é a fórmula que o proprietário documentou, e não as fórmulas
nativas do Sheets que porventura calculem outras colunas. O conteúdo das quatro planilhas foi
processado por inteiro; as contagens abaixo cobrem as 419 linhas.

## O padrão em uso

O SKU é montado por concatenação de campos com hífen, do mais geral para o mais específico:

```text
MATERIAL - [FORMA] - TIPO_PRODUTO - MEDIDA
VC        - TRE     - RED          - 1/2
```

As abreviações são de três letras e consistentes onde aparecem: `TRE` trefilado, `LAM` laminado,
`DES` descascado, `FOR` forjado, `RED` redondo, `BAR` barra chata, `QUA` quadrado, `ARA` arame.

**A intenção é clara e é boa**: o código descreve o produto, é legível por quem conhece o negócio, e
ordena naturalmente quando listado. Não é um código sequencial opaco, e não é acidental — há um
vocabulário controlado por trás.

## Onde o padrão diverge de si mesmo

Estas são observações sobre a fonte, não críticas ao trabalho manual: são exatamente o tipo de
divergência que aparece quando um padrão vive em planilhas separadas, e são o que um padrão
formalizado precisa resolver.

### 1. Três grafias para o mesmo campo material

| Grafia                           | Exemplo                        | Ocorrências |
| -------------------------------- | ------------------------------ | ----------- |
| Sigla única                      | `VC-...`, `VND-...`            | 106         |
| Norma e número unidos            | `SAE1020-...`                  | 106         |
| Norma e número em dois segmentos | `SAE-4140-...`, `AISI-304-...` | 205         |

Ou seja, `SAE 1020` virou `SAE1020` e `SAE 4140` virou `SAE-4140`. O mesmo campo conceitual ocupa
um ou dois segmentos conforme a planilha.

### 2. O terceiro segmento significa coisas diferentes

- Em `VC-TRE-RED-1/2`, o terceiro segmento (`RED`) é o **tipo de produto**.
- Em `SAE-4140-TRE-RED-1/2`, o terceiro segmento (`TRE`) é a **forma**, e o tipo de produto foi para
  o quarto.

Um leitor — ou um programa — não consegue interpretar o segmento pela posição.

### 3. O número de segmentos é variável

De 4 a 6 segmentos, porque tanto o material quanto a forma podem ocupar um ou dois:
`VC-TRE-RED-7/16` (4), `SAE-4140-TRE-RED-1/2` (5), `SAE-4140-TRE-DES-RED-2-5/8` (6, com forma
composta "trefilado, descascado") e `SAE-4140-LAM-FOR-RED-4` (laminado e forjado).

### 4. O hífen é separador de campo e também parte da medida

`VC-TRE-RED-1-1/8` significa "1 1/8 polegada", mas o `-` antes de `1/8` é indistinguível de um
separador de campo. É a ambiguidade mais séria do padrão atual: quebrar o código em campos exige
saber de antemão quantos campos ele tem.

### 5. Campo vazio deixa buraco visível

As barras chatas não têm `FORMA` preenchida, e o código sai com hífen duplo: `VC--BAR-1/2X1/8`.

### 6. Cinco grafias de medida convivem

| Grafia                        | Exemplo           | Ocorrências |
| ----------------------------- | ----------------- | ----------- |
| Fração de polegada            | `3/8`, `7/16`     | 254         |
| Polegada inteira              | `1`, `4`          | 58          |
| Milímetro com zero à esquerda | `006MM`, `025MM`  | 34          |
| Milímetro decimal com ponto   | `0.1MM`, `4.76MM` | 33          |
| Largura × espessura           | `1/2X1/8`         | 22          |

O zero à esquerda (`006MM`) serve para ordenar alfabeticamente na planilha — é uma solução de
planilha, não de catálogo, e some quando a ordenação passa a ser feita por uma coluna numérica.

### 7. Ruído de planilha

Três linhas não são produtos: são anotações em células mescladas que entraram na área de dados
(`[merged] AÇO SAE - 4140`, `H 2 1/4" => RED 2 5/8"`, aparentemente notas de equivalência de bitola
para o fornecedor). Numa importação isso precisa ser descartado explicitamente.

## O que a planilha revela além do SKU

### A fórmula de preço é uma só

416 das 419 linhas usam exatamente a mesma fórmula documentada:

```text
PRECO_BASE   = CEILING((COMPRIMENTO * 1,05) * (PESO_KG_M * 1,05) * (ROUNDUP(PRECO_KG * 10; 0) / 10); 0,1)
VALOR_IPI    = PRECO_BASE * IPI/100
PRECO_TOTAL  = PRECO_BASE + VALOR_IPI
```

Ela confirma o que a ADR-0010 assumiu: **o preço sai de comprimento × peso por metro × preço por
quilo**. Os dois fatores `1,05` são margens de segurança (5% no comprimento e 5% no peso), o
`ROUNDUP(PRECO_KG * 10; 0) / 10` arredonda o preço do quilo para cima ao décimo, e o `CEILING(…;
0,1)` arredonda o resultado final para cima de dez em dez centavos. Todo arredondamento é para
cima — nunca para baixo.

Isso não pertence a este recorte, mas fica registrado porque é a regra de precificação real do
negócio e vai reaparecer quando venda e precificação forem tratadas.

### As colunas confirmam a ADR-0010

O mapeamento é quase um para um, o que é uma validação forte do modelo já implementado:

| Coluna da planilha                                   | Onde vive hoje                                           |
| ---------------------------------------------------- | -------------------------------------------------------- |
| `TIPO_MATERIAL`, `FORMA`, `TIPO_PRODUTO`             | facetas tipadas (eixos e opções)                         |
| `LARGURA_MM`, `ESPESSURA_MM`, `COMPRIMENTO_PADRAO_M` | geometria (`widthMm`, `thicknessMm`, `lengthMm`)         |
| `PESO_KG_M`, `PESO_KG_M2`                            | geometria (`weightPerMeterKg`, `weightPerSquareMeterKg`) |
| `LARGURA`, `ESPESSURA` (em polegada)                 | apresentação, derivada do milímetro                      |
| `SINONIMOS`                                          | sem lugar ainda — ver abaixo                             |
| `NIVEL_COMERCIAL`                                    | sem lugar ainda — ver abaixo                             |
| `NCM`, `IPI`                                         | perfil fiscal (fase própria)                             |
| `PRECO_*`                                            | precificação (recorte próprio)                           |

Note que a planilha guarda a medida **nas duas unidades** — `LARGURA` em polegada e `LARGURA_MM` em
milímetro. A ADR-0010 recusou justamente isso, mantendo só o milímetro e derivando a polegada. Vale
registrar que a fonte não diverge do sistema: as colunas em polegada da planilha são fração exata
das colunas em milímetro, então derivar não perde nada.

### Vocabulário levantado

Candidatos naturais a opções das facetas já existentes, extraídos das 419 linhas:

- **Material**: VC, VND, SAE 1020, SAE 1045, SAE 4140, SAE 4340, AISI 302, AISI 304 (e menções a
  SAE 8620 e 8640 nas anotações soltas)
- **Forma**: trefilado, laminado, descascado, forjado — e as combinações "trefilado, descascado" e
  "laminado, forjado", que **são duas facetas simultâneas no mesmo eixo**, algo que o modelo atual
  não permite (uma opção por eixo). Isso precisa de decisão: ou vira um eixo "processo" multivalor,
  ou "laminado e forjado" é uma opção própria
- **Tipo de produto**: redondo, barra chata, quadrado, arame
- **Nível comercial**: `DISPONÍVEL` (332) e `SOB_CONSULTA` (84). Não é faceta técnica: é situação
  comercial, e os 84 `SOB_CONSULTA` são exatamente os que estão sem `PRECO_KG`

### Dois campos sem lugar no modelo atual

- **`SINONIMOS`** — cada linha traz uma lista de como o cliente chama a peça: "vergalhão 7/16",
  barra 7/16", ferro 7/16", varão 7/16", redondo 7/16", trefilado 7/16"". É vocabulário de busca do
  cliente, e hoje a busca de produtos cobre só SKU e descrição curta
- **`DESCRICAO`** — ficha técnica longa por material (composição, dureza, aplicação), repetida
  linha a linha. É atributo do material, não do produto individual; hoje caberia em
  `technicalDescription`, ao custo de repetir o mesmo texto em dezenas de produtos

## Decisão do proprietário (2026-09-04)

Duas definições já dadas, que estreitam a ADR:

1. **O SKU é imutável.** Confirma a regra que o sistema já aplica.
2. **O SKU deve carregar conhecimento único do material**, para que procurar por SKU seja fácil.
   Ou seja, permanece um código falante — a alternativa opaca está descartada.

**A tensão que sobra, e que a ADR precisa resolver:** imutável e falante ao mesmo tempo significa
que reclassificar um produto não pode mudar o código. Na prática, ou o SKU carrega apenas o que
**não muda** na vida do produto (o material e a geometria são candidatos; a situação comercial e
possivelmente a forma não são), ou reclassificar passa a exigir produto novo. Escolher o que entra
no código é escolher o que se declara imutável.

Ficou para validar na próxima sessão.

## Perguntas que a ADR do SKU precisa responder

1. **O SKU carrega significado ou é opaco?** A planilha mostra um código falante, e ele é útil no
   dia a dia. Mas ele tem o mesmo defeito da `Referência` do legado: **muda quando a classificação
   muda**. Trocar a forma de um produto de trefilado para descascado mudaria o SKU, e o SKU é
   imutável no sistema por decisão já tomada — apresentações e mapeamentos de fornecedor o
   referenciam
2. Se falante, **como resolver a ambiguidade do hífen** na medida, o número variável de segmentos e
   as três grafias de material
3. **Qual unidade vai no código** — a planilha usa polegada onde o setor usa polegada e milímetro
   onde usa milímetro, o que é honesto com o uso real, mas cria duas famílias de código para a mesma
   grandeza
4. **Como representar processo composto** ("trefilado, descascado") tanto no código quanto nas
   facetas
5. Se opaco, **onde o código falante continua vivendo** — provavelmente como um rótulo derivado e
   recalculável, ao lado do SKU, que pode mudar sem quebrar referência nenhuma

## Próximo passo

Discutir as cinco perguntas com o proprietário e registrar a decisão em ADR própria. Só depois
mexer em validação de SKU. Enquanto isso vale o que já está no handoff: **não inventar padrão**.
