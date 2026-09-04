# Domínio — distribuição de aço e metais

- Atualizado em: 2026-09-04
- Origem: questionário respondido pelo proprietário em 2026-09-04 (18 de 18 perguntas)
- Escopo: registra como o negócio funciona, para que decisões de modelagem parem de ser suposição

Este documento é descritivo, não normativo. Ele não decide schema; as decisões derivadas dele estão
nos ADRs, que têm precedência. Onde uma afirmação aqui divergir do código, o código e os ADRs
mandam — e este arquivo é que está desatualizado.

## O negócio

Distribuidora de aço e metais no Simples Nacional, um CNPJ, São Paulo. Compra material de
siderúrgicas e distribuidores, **corta na medida solicitada pelo cliente** e revende. O corte é
prestação de serviço embutida no preço por quilo, não uma linha separada.

O catálogo legado tem cerca de **5.800 itens** cadastrados sem padrão, que precisarão ser
importados e reorganizados.

## Como os produtos são descritos

A variedade é grande e **os eixos de classificação mudam conforme a linha de produto**:

| Linha       | Eixos que a descrevem                                          |
| ----------- | -------------------------------------------------------------- |
| Aço carbono | liga (SAE 1020, 1045), processo (laminado, trefilado, forjado) |
| Alumínio    | liga e têmpera (6351-T6, 6063-T5)                              |
| Tubos       | schedule (10, 20, 40, 80)                                      |
| Bronze      | composição (grafitado, TM23, TM620)                            |
| Cobre       | tipo (cromo, eletrolítico)                                     |
| Inox        | formato de chapa (2000×1000, 2000×1200)                        |

Não são três eixos fixos. "Schedule" não existe em chapa, "têmpera" não existe em aço carbono, e o
número de chapa (chapa 30 = 0,32 mm; chapa 11 = 3,18 mm = 1/8″) é uma escala própria de um
subconjunto de produtos.

Novos eixos surgem, e o proprietário quer que **usuários com permissão criem eixos novos sem pedir
alteração de sistema**.

A classificação é estável: uma vez cadastrado, o produto raramente muda de eixo. Muda o fornecedor;
a especificação continua a mesma.

## Medida, peso e preço

Esta é a parte que mais influencia a modelagem, e a que estava mais incerta.

**A medida entra em cálculo.** Não é rótulo. O preço de venda sai de uma conta feita hoje na
calculadora:

```text
barra:  comprimento (m) × peso/m (kg/m)   × preço/kg
chapa:  largura (m) × espessura           × peso/m² × preço/kg
```

Exemplo real do proprietário — 500 mm de SAE 1045 de 10 mm:

```text
0,500 m × 0,650 kg/m × R$ 19,80/kg
```

**O peso é teórico, não pesado.** O proprietário usa o peso teórico por metro, que é universal para
cada bitola e material. A balança não participa do preço. O peso serve também para controlar
estoque.

**Milímetro e polegada convivem e devem se equivaler.** O proprietário pediu explicitamente: ao
preencher milímetros, o sistema mostra a polegada correspondente; ao preencher polegadas, mostra os
milímetros. As duas representações são o mesmo valor, não dois campos independentes.

**As unidades de venda variam**: milímetro, polegada, peça, metro — e o faturamento é em quilo.

**O fornecedor oscila entre milímetro e polegada para o mesmo produto.** Há fornecedor que trata o
milímetro como verdade na NF-e mas às vezes emite em polegada, e o inverso também acontece. Não é
divergência entre fornecedores, que seria previsível: é o mesmo fornecedor alternando entre notas.

A consequência é que a unidade que chega no XML **não pode ser a unidade do cadastro**. Se o produto
fosse criado com o que veio no documento, a mesma barra viraria dois produtos distintos conforme a
nota que a trouxe. A chave de correspondência já protege parte disso — o vínculo é
`fornecedor + código do fornecedor`, e o código não oscila — mas a medida e a unidade precisam ser
normalizadas na entrada.

O proprietário pretende **criar os produtos durante a ingestão do XML**, para que o padrão nasça
junto com o catálogo em vez de ser corrigido depois. Esse fluxo já existe em `ProductMappingForm`
("Criar produto"), que cria produto e mapeamento de fornecedor durante a resolução do item.

## Estoque

**Não existe controle de estoque hoje.** Há um balanço anual, no fim do ano, para saber a
quantidade em peso. O controle de estoque será construído do zero e o proprietário pediu apoio no
desenho — não há processo legado a replicar aqui.

## Preço

- Muda cerca de **quatro vezes por ano**, para cima e para baixo, acompanhando o mercado.
- Histórico de preço é desejado ("seria interessante saber quanto custava").
- Variação por cliente: **quer implementar**, não existe hoje.
- Variação por volume: existe de fato, ligada ao **número de cortes**, hoje embutida no preço/kg.
- Prazo: à vista tem 3% de desconto; o proprietário quer ampliar as estratégias de desconto.

## Fiscal

- **cBenef está resolvido no legado.** A contabilidade forneceu a equivalência NCM↔cBenef e o
  sistema atual já preenche sozinho; não há mais preenchimento manual.
- **IBS e CBS já saem nas notas** do sistema atual. O prazo de 4 de janeiro de 2027 **não é
  urgência deste projeto** — o legado já foi adequado. O sistema novo precisará fazer o mesmo
  quando emitir.
- **Emissão de NF-e não tem prazo.** Será feita por **API de terceiros**, não por implementação
  própria do protocolo SEFAZ. O prestador ainda não foi escolhido; o critério declarado é ter
  demonstração gratuita durante o desenvolvimento.

## Certificados e rastreabilidade — fora de escopo por ora

O proprietário classificou os dois como "sugestão de desenvolvimento futuro":

- **Certificados de qualidade** chegam impressos junto com a nota. A ideia é digitalizá-los e
  emitir um certificado próprio derivado do certificado do fornecedor. Poucos clientes pedem, e não
  há pessoal alocado para isso hoje.
- **Rastreabilidade por lote** não é requisito. Reclamações são raras; quando ocorrem, o
  proprietário faz análise química para verificar se o processo do cliente (têmpera, usinagem)
  causou o problema.

A consequência é direta: o estoque pode ser saldo derivado de movimentos imutáveis **sem
identidade de lote**. Acrescentar lote depois é caro, e essa é uma escolha consciente, não um
esquecimento.

## Operação

- **Um CNPJ hoje.** O multiempresa foi adotado desde o início para comportar CNPJs futuros por
  motivo de gestão fiscal e contábil — não é generalização especulativa.
- **Permissões granulares por usuário** são desejadas, habilitáveis individualmente. Hoje a escrita
  é restrita a `OWNER` e `ADMIN`.

## O que não replicar do legado

Confirmado pelas respostas e mantido de `ai-handoff.md`: estoque atual, custo médio, custo de
reposição e datas de última entrada/saída são derivados de movimentos e não devem virar coluna. A
descrição concatenada e a referência com código inteligente também não.
