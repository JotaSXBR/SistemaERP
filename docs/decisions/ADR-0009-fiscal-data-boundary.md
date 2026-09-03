# ADR-0009 — Fronteira do dado fiscal

- Status: aceito
- Data: 2026-09-03

## Contexto

O sistema legado que este ERP substitui guarda `Situação Tributária`, `CSOSN`, `% Red. ICMS`,
`Origem` e `CEST` como colunas fixas no cadastro do produto, sem qualquer noção de vigência. É
exatamente por isso que ele não sobrevive ao ritmo atual de mudança da legislação.

Só entre abril e setembro de 2026 aconteceram quatro mudanças relevantes para a operação em São
Paulo:

| Quando               | O que mudou                                                                        |
| -------------------- | ---------------------------------------------------------------------------------- |
| 6 de abril de 2026   | cBenef obrigatório em SP (Portaria SRE 70/2025), inclusive para o Simples Nacional |
| 1º de julho de 2026  | SEFAZ-SP desativa o código genérico "Sem cBenef"                                   |
| 3 de agosto de 2026  | IBS/CBS obrigatórios na NF-e para Lucro Real e Presumido (NT 2025.002)             |
| 4 de janeiro de 2027 | IBS/CBS obrigatórios para Simples Nacional e MEI                                   |

Além disso, os regimes antigo (ICMS, IPI, PIS, COFINS) e novo (IBS, CBS, IS) **coexistem até 2032**.

A leitura estruturada de 35 XMLs reais de fornecedores confirmou que isso já é presente, não
futuro: 187 de 204 itens já trazem o grupo `IBSCBS`, e um item já traz `IS`.

Este ADR decide **onde cada natureza de dado fiscal vive**. Ele não decide como calcular tributo:
a emissão não está no escopo atual, e a interpretação da norma é da contabilidade, não deste
sistema.

## Decisão

### Três naturezas distintas, três lugares

| Natureza               | Onde vive                                         | Exemplos                                   |
| ---------------------- | ------------------------------------------------- | ------------------------------------------ |
| Atributo do produto    | `Product`                                         | NCM, origem da mercadoria, GTIN            |
| Atributo da operação   | resolvido na emissão, nunca persistido no produto | cBenef, CFOP, CST/CSOSN                    |
| Declaração de terceiro | snapshot do documento                             | o que o emitente informou na NF-e recebida |

O caso que motiva a separação é o **cBenef**: ele depende da operação — CFOP, destino, tipo de
cliente, benefício aplicado. O mesmo produto tem cBenef diferente em vendas diferentes. Guardá-lo
no produto seria repetir o erro do legado, e desfazer isso depois de gravar produtos reais é caro.

### Dado fiscal recebido é transcrição, não interpretação

`InboundFiscalDocumentItemTax` guarda o grupo `imposto` de cada item como **o que o emitente
declarou**. Este sistema não recalcula nem corrige esses valores. A tabela é 1:1 com o item e
separada de `InboundFiscalDocumentItem` porque são vinte campos de natureza distinta da
identificação comercial do item.

Todos os campos são opcionais, por três razões: os grupos variam conforme CST e CSOSN; os dois
regimes coexistem na transição; e o documento de produto proíbe preencher com zero o que não
existe. **Ausência permanece ausência** — um item sem grupo `imposto` não gera linha.

### O XML original é a fonte verbatim

O que não está projetado em colunas continua recuperável no XML preservado no object storage, com
SHA-256. Por isso **não** existe uma coluna JSONB espelhando o grupo inteiro: ela duplicaria o
original sem ser mais confiável que ele, e criaria uma segunda fonte de verdade.

Consequência aceita: `Decimal` normaliza zeros à direita, então `11.1100` volta da API como
`11.11`. O valor numérico é idêntico; a escala exatamente como declarada está no XML.

### Nenhuma abstração de motor fiscal por antecipação

Não existem, e não devem ser criadas antes de a emissão ser requisito real com regras confirmadas:
tabelas de vigência vazias, resolvedor de cBenef, cálculo de tributo, árvore de decisão de
CST/CSOSN. O `ai-handoff.md` proíbe pacotes genéricos por antecipação, e abstração construída sobre
suposição de norma fica errada e cara de desfazer.

### Quando a emissão entrar no escopo

Duas regras já ficam decididas, porque são o que torna o modelo capaz de acompanhar a legislação:

1. **Todo dado fiscal com efeito de cálculo carrega vigência.** Um documento emitido em junho tem
   de continuar legível com as regras de junho.
2. **O modelo é "qual regime, qual período"**, nunca "os campos de imposto". Os dois regimes
   coexistem até 2032 e precisam conviver na mesma base.

## Consequências

- A caixa de entrada passa a expor o que o fornecedor declarou, o que habilita a reconciliação de
  totais prevista para a Fase 8.2.
- Documentos já ingeridos antes desta mudança não têm snapshot fiscal. Como o XML e o hash estão
  preservados, um reprocessamento pode preenchê-los; nada foi perdido.
- `cBenef` não aparece em nenhum dos 35 XMLs analisados, então sua extração está exercitada apenas
  por fixture sintética, não por dado real.
- Os valores de IBS/CBS por ente (`gIBSUF`, `gIBSMun`) e o grupo `IS` são reconhecidos na estrutura
  mas ainda não projetados em colunas; entram quando houver uso concreto.
