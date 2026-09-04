# Exibição de polegadas a partir de milímetros

- Versão: 1.0
- Data: 2026-09-04
- Origem: especificação do proprietário
- Implementação: `apps/web/src/features/registry/measure.ts` (`formatInches`)

## Objetivo

Padronizar a conversão e a exibição de valores dimensionais em polegadas quando o sistema opera
internamente em milímetros. O objetivo é consistência visual: nada de decimal de polegada, apenas
as frações convencionais da indústria.

Esta especificação complementa a [ADR-0010](../decisions/ADR-0010-product-attributes-and-geometry.md),
que decidiu o milímetro como unidade canônica e a polegada como apresentação.

## Princípios

1. O sistema **sempre** armazena e processa em **milímetro**.
2. A conversão para polegada acontece **apenas na exibição**.
3. É **proibido** decimal de polegada (`0.25"`, `0.5"`, `1.25"`).
4. A exibição usa **exclusivamente** as frações da tabela de referência.
5. A escolha da fração é por **proximidade** ao valor de referência em milímetro.

## Tabela de referência oficial

| Fração | mm    | Fração | mm    |
| ------ | ----- | ------ | ----- |
| 1/32"  | 0,79  | 17/32" | 13,49 |
| 1/16"  | 1,59  | 9/16"  | 14,29 |
| 3/32"  | 2,38  | 19/32" | 15,08 |
| 1/8"   | 3,18  | 5/8"   | 15,88 |
| 5/32"  | 3,97  | 21/32" | 16,67 |
| 3/16"  | 4,76  | 11/16" | 17,46 |
| 7/32"  | 5,56  | 23/32" | 18,26 |
| 1/4"   | 6,35  | 3/4"   | 19,05 |
| 9/32"  | 7,14  | 25/32" | 19,84 |
| 5/16"  | 7,94  | 13/16" | 20,64 |
| 11/32" | 8,73  | 27/32" | 21,43 |
| 3/8"   | 9,53  | 7/8"   | 22,23 |
| 13/32" | 10,32 | 29/32" | 23,02 |
| 7/16"  | 11,11 | 15/16" | 23,81 |
| 15/32" | 11,91 | 31/32" | 24,61 |
| 1/2"   | 12,7  | 1"     | 25,4  |

**A tabela descreve a parte fracionária de qualquer polegada, não apenas a primeira.** Ela vale de
0 a 1", e se repete a cada polegada inteira daí para cima: 3,18 mm é `1/8"`, e 79,38 mm — três
polegadas a mais — é `3 1/8"`. Não há limite superior; 6000 mm é `236 7/32"`.

A tabela é a série de trigésimos-avos de polegada, reduzida. Por isso arredondar para o múltiplo de
1/32" mais próximo seleciona a mesma linha que comparar a tabela item a item — é assim que
`formatInches` está implementada, e é o que a suíte de testes verifica linha por linha, inclusive
com a tabela inteira deslocada para uma polegada diferente da primeira.

## Regras de conversão

- **Seleção**: a fração cujo valor de referência em milímetro tenha a menor diferença absoluta.
- **Desempate**: distância idêntica entre duas frações consecutivas resolve pela **fração maior**.
- **Abaixo de 1/32"** (menos de 0,79 mm): exibir `0"`.
- **Acima de 1"**: separar parte inteira da fracionária e exibir `[inteiro] [fração]"`. A regra vale
  para qualquer valor, sem teto — a fração some quando a parte fracionária é zero.
  - 31,75 mm → `1 1/4"`
  - 38,10 mm → `1 1/2"`
  - 50,80 mm → `2"`
  - 304,80 mm → `12"`
  - 1000 mm → `39 3/8"`
  - 6000 mm → `236 7/32"`

## Formato de exibição

| Situação                 | Formato  | Exemplo  |
| ------------------------ | -------- | -------- |
| Fração simples           | `X/Y"`   | `3/8"`   |
| Polegada inteira         | `N"`     | `1"`     |
| Polegada e fração        | `N X/Y"` | `1 1/4"` |
| Zero ou abaixo do limite | `0"`     | `0"`     |

- Barra `/` como separador de fração.
- Aspas duplas `"` imediatamente após o número, sem espaço.
- Nenhuma outra forma do símbolo de polegada: nem `″`, nem `in`, nem `pol`.

## Proibições

- Exibir decimal de polegada.
- Usar fração fora da tabela de referência.
- Arredondar por critério diferente do de proximidade definido aqui.
- Alterar a unidade de armazenamento, que permanece o milímetro.

## Responsabilidade de implementação

A conversão e a formatação ficam centralizadas em um único utilitário, para que telas, relatórios,
etiquetas e exportações usem o mesmo critério. Hoje esse utilitário é `formatInches`, em
`apps/web/src/features/registry/measure.ts`.

Quando a exibição de polegada chegar a relatórios, etiquetas ou exportações — inclusive fora do
`apps/web` —, a função deve ser promovida a um pacote compartilhado em vez de reimplementada. Duas
implementações da mesma tabela divergem com o tempo, e a divergência aparece como duas medidas
diferentes para a mesma peça.
