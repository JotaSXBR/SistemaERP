# Roteiro funcional do ERP

## Objetivo

Este roteiro sucede a fundação técnica e orienta a construção incremental das funcionalidades de
negócio. Cada fase deve entregar um fluxo vertical utilizável, preservar as fronteiras do monólito
modular e produzir fatos confiáveis para as fases seguintes.

Escopos tributários devem ser confirmados com a contabilidade antes de entrar em produção. A
documentação do produto não substitui interpretação fiscal ou jurídica.

## Sequência

| Fase | Resultado esperado                                        | Estado     | Referência                                                     |
| ---- | --------------------------------------------------------- | ---------- | -------------------------------------------------------------- |
| 8    | Catálogo enriquecido, entrada fiscal e estoque rastreável | Planejada  | [Fase 8](phase-8-receiving-inventory.md)                       |
| 9    | Orçamento, pedido, preços e reserva de estoque            | Referência | A detalhar depois da validação da Fase 8                       |
| 10   | Venda, emissão fiscal e devoluções                        | Referência | A detalhar depois da escolha e prova do provedor fiscal        |
| 11   | Contas a receber, caixa e conciliação                     | Referência | A detalhar depois que vendas produzirem títulos confiáveis     |
| 12   | Compras, reposição e contas a pagar                       | Referência | A detalhar depois que estoque e financeiro estiverem validados |
| 13   | Fechamento, inventário e exportações fiscais/contábeis    | Referência | A detalhar com a contabilidade responsável                     |

## Dependências entre as fases

```text
Fase 8: catálogo + entrada + estoque
   |
   +--> Fase 9: pedido + preço + reserva
   |       |
   |       +--> Fase 10: venda + documento fiscal
   |                  |
   |                  +--> Fase 11: recebimento + caixa
   |
   +--> Fase 12: compras + reposição + contas a pagar
                           |
                           +--> Fase 13: fechamento + exportações
```

A emissão fiscal da Fase 10 usará uma porta interna independente do fornecedor. A pesquisa e a
recomendação provisória estão em
[Provedores e integração fiscal](../integrations/fiscal-providers.md).

## Regras para detalhar as próximas fases

- Usar os fatos e os identificadores estabelecidos na fase anterior; não criar cadastros paralelos.
- Entregar um fluxo operacional completo antes de ampliar relatórios e configurações.
- Tratar dinheiro e quantidades fracionárias como decimal.
- Capturar snapshots de informações comerciais e fiscais nos documentos históricos.
- Tornar idempotentes importações, webhooks, emissões e conciliações.
- Registrar auditoria estruturada para aprovações, ajustes e mudanças de estado relevantes.
- Adiar infraestrutura auxiliar até existir uma carga real que a justifique.

## Gate para iniciar a Fase 9

A Fase 9 só deve ser detalhada quando a Fase 8 tiver validado em uso real:

- identidade e apresentação dos produtos;
- unidades de estoque, venda e tributação;
- conversões e dimensões usadas na operação;
- recebimento de XML e mapeamento fornecedor-produto;
- saldo de estoque reconciliado;
- armazenamento e recuperação de certificados de qualidade;
- estratégia repetível de extração do sistema legado.
