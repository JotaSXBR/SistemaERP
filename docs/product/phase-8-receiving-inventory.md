# Fase 8 — Catálogo, entrada fiscal e estoque rastreável

- Estado: Planejada
- Data da definição: 2026-08-31
- Predecessora: Fase 7 — Primitivas de plataforma

## Objetivo

Entregar a primeira funcionalidade de negócio do ERP: receber documentos fiscais de compra,
relacionar os itens dos fornecedores a um catálogo enriquecido e produzir saldo de estoque
auditável.

O fluxo deve aproveitar o serviço fiscal já utilizado para obter XMLs, aceitar importação manual
como contingência e preparar os dados que alimentarão vendas, compras, financeiro e obrigações
fiscais nas fases seguintes.

## Contexto confirmado

- A operação comercializa metais e ferragens no atacado e no varejo.
- Um mesmo material pode ser vendido em apresentação, dimensão e unidade solicitadas pelo cliente.
- Há certificados de qualidade para a maioria dos produtos, mas ainda não há controle formal por
  lote, corrida ou rastreabilidade até a saída.
- O recebimento de documentos fiscais usa SIEG.
- O sistema legado tem mais de vinte anos e usa um banco Firebird em arquivo.
- A empresa não usa NFC-e atualmente. A aplicabilidade da NFC-e à operação real deve ser validada
  com a contabilidade antes da Fase 10.
- A data de abertura é um fato cadastral distinto das alterações posteriores de sócios, natureza ou
  atividade. O modelo não deve condensar esses fatos em uma única data de situação.

Nenhum identificador, endereço, certificado ou dado real da empresa deve ser incluído em fixtures,
seeds, documentação de exemplo ou testes.

## Resultado operacional

Ao concluir a fase, um usuário autorizado deve conseguir:

1. obter uma NF-e de entrada pela integração SIEG ou fornecer seu XML manualmente;
2. visualizar a origem e a validação do arquivo antes de qualquer efeito no estoque;
3. identificar o fornecedor e mapear cada código do fornecedor para um produto interno;
4. criar ou complementar um produto sem perder o texto original do documento;
5. informar apresentação, dimensões, conversão e certificado de qualidade quando aplicáveis;
6. confirmar o recebimento uma única vez;
7. consultar os movimentos, o saldo físico e a origem documental do estoque;
8. recuperar o XML e os certificados vinculados ao recebimento.

## Escopo

### Parceiros

O cadastro deve representar uma pessoa ou organização uma única vez e permitir os papéis de
fornecedor, cliente, transportador ou outros papéis futuros.

Dados mínimos desta fase:

- nome e nome comercial;
- CPF ou CNPJ como texto, compatível com CNPJ numérico e alfanumérico;
- inscrições e indicador de contribuinte quando aplicável;
- endereços com vigência ou histórico suficiente para documentos;
- situação interna ativa ou inativa;
- códigos usados pelo sistema legado e por integrações externas.

O `organizationId` vem exclusivamente do contexto autenticado. Identificadores fiscais informados
em payload não concedem acesso ao tenant.

### Catálogo enriquecido

O catálogo separa a identidade estável do produto de sua apresentação comercial e do snapshot
usado em cada documento.

#### Identidade e classificação

- SKU interno imutável;
- descrição curta e descrição técnica;
- família, grupo e marca ou fabricante quando relevantes;
- tipo de material, liga ou qualidade, norma técnica, acabamento e formato ou perfil;
- NCM, CEST quando aplicável, origem, GTIN e perfil fiscal com vigência;
- produto ativo ou inativo, sem apagar referências históricas.

#### Geometria e características técnicas

Os atributos devem ser estruturados quando influenciam identificação, cálculo ou busca:

- espessura;
- largura e altura;
- diâmetro interno e externo;
- comprimento;
- peso teórico e peso informado;
- densidade ou fórmula de conversão somente quando tecnicamente validada;
- tolerância e norma, quando usadas na operação.

Nem todo produto terá todos os atributos. Não se deve criar uma coluna genérica de texto para
informações usadas em cálculo, nem preencher medidas inexistentes com zero.

#### Unidades e apresentações

Cada produto deve declarar explicitamente:

- unidade base de estoque;
- apresentações permitidas para compra e venda;
- unidade comercial e unidade tributável usadas no documento fiscal;
- fator de conversão exato quando fixo;
- regra para conversão informada por operação quando peso ou medida efetiva varia;
- quantidade, unidade e descrição efetivamente usadas como snapshot no item do documento.

O pedido do cliente pode alterar a apresentação da venda, mas não pode mudar silenciosamente a
identidade ou o saldo do produto. Conversões variáveis devem ser informadas, validadas e auditadas
na linha da operação.

#### Correspondência com fornecedores

Uma relação própria deve mapear:

```text
fornecedor + código/descrição do fornecedor -> produto/apresentação interna
```

O mapeamento não pode usar somente descrição aproximada. Sugestões automáticas podem ajudar o
usuário, mas a primeira associação ou uma associação ambígua exige confirmação determinística e
auditada.

### Documentos e recebimento

O documento fiscal de entrada preserva:

- chave de acesso e protocolo;
- emitente, destinatário e datas relevantes;
- XML original, hash criptográfico, fonte e instante de obtenção;
- totais monetários como decimal;
- itens e seus valores, quantidades, unidades, descrições e classificações originais;
- eventos posteriores, como cancelamento e manifestação;
- estado de validação, recebimento e escrituração interna;
- vínculo entre item externo, item recebido e produto interno.

A chave de acesso deve ser única por organização. Reimportar o mesmo documento retorna o resultado
existente; não cria uma segunda entrada nem duplica estoque.

O XML obtido da SIEG e o XML fornecido manualmente passam pelo mesmo pipeline. A origem é registrada
como proveniência e não altera as regras de validação.

### Estoque

O estoque será um livro de movimentos, não um número editável sem origem.

Cada movimento contém:

- organização, depósito e localização quando aplicável;
- produto e apresentação;
- quantidade decimal e unidade base;
- natureza do movimento;
- documento, item e operação de origem;
- instante UTC, usuário ou integração responsável e correlação da requisição;
- motivo obrigatório para ajustes manuais.

O saldo é derivado dos movimentos. Ajustes são novos movimentos de correção, nunca alteração ou
exclusão de um movimento histórico.

Reservas e saldo disponível terão o modelo preparado, mas o fluxo de reserva pertence à Fase 9.
Custos devem ser preservados na entrada; a política definitiva de custeio será decidida antes de
usar o valor como verdade contábil.

### Certificados de qualidade

O certificado é um documento associado ao recebimento e, quando possível, aos seus itens. Deve
conter:

- arquivo original e hash;
- emissor e identificação textual do certificado;
- datas de emissão e validade, quando existirem;
- documento e itens de entrada relacionados;
- metadados técnicos extraídos ou informados, sem descartar o original;
- histórico de inclusão, substituição lógica e consulta.

Sem controle de lote ou corrida, o sistema consegue provar que um certificado foi recebido junto a
determinada entrada, mas não consegue afirmar que uma saída específica veio daquele lote de
fabricação. Essa limitação deve aparecer na interface e nos relatórios.

`Corrida` ou `heat number` é a identificação de uma batelada de produção metalúrgica. Durante a
Fase 8 será verificado se esse número aparece nos certificados recebidos. Capturá-lo como metadado
não ativa rastreabilidade por lote; essa será uma decisão posterior baseada no processo real.

## Fluxo principal

```text
SIEG ou upload manual
        |
        v
caixa de entrada fiscal idempotente
        |
        v
validação XML + destinatário + protocolo + totais
        |
        v
mapeamento fornecedor/produto/apresentação
        |
        v
prévia + certificado + confirmação humana
        |
        v
recebimento e movimentos de estoque na mesma transação
        |
        v
saldo, histórico e documentos recuperáveis
```

Falha em armazenamento, validação ou movimento impede a confirmação parcial. Reprocessamento usa a
mesma chave de idempotência e deve poder reconciliar o resultado.

## Integração SIEG

A documentação pública da SIEG expõe API para sistemas externos e operações de download de XML
específico e em lote. A integração da fase será somente de leitura e terá três passos antes da
implementação definitiva:

1. confirmar no contrato atual se a API está habilitada e obter credenciais próprias de integração;
2. levantar autenticação, paginação, filtros, limites, retenção, eventos e comportamento de erro na
   versão efetivamente contratada;
3. executar uma prova com documentos sintéticos ou devidamente protegidos, sem registrar segredo ou
   XML real em logs e fixtures.

A API não será a única forma de entrada. Upload manual de XML permanece como contingência e facilita
testes. Consulta direta à Distribuição DF-e poderá ser outro adaptador futuro, sem alterar o caso de
uso de recebimento.

Referências consultadas em 2026-08-31:

- [Portal de integrações SIEG](https://integracoes.sieg.com/)
- [Swagger público da API SIEG](https://api.sieg.com/swagger/ui/index)
- [Portal Nacional — Distribuição de DF-e](https://www.nfe.fazenda.gov.br/POrtal/exibirArquivo.aspx?conteudo=155Wx5%2FJB5A%3D)

## Arquivos e armazenamento

XMLs e certificados criam o primeiro uso real para armazenamento de objetos previsto na
arquitetura. A implementação deve:

- manter metadados, vínculo, estado, tamanho e hash no PostgreSQL;
- guardar o conteúdo em backend S3 compatível, com MinIO local como candidato;
- criptografar em trânsito e em repouso;
- negar URLs públicas e usar autorização por organização;
- verificar tipo, tamanho e conteúdo antes de aceitar upload;
- ter política de backup, retenção e restauração testada;
- não depender da retenção exclusiva da SIEG ou do futuro emissor fiscal.

A escolha definitiva do backend e sua operação devem ser registradas antes de adicionar a
dependência. Armazenar temporariamente não pode significar descartar o original após o recebimento.

## Migração do Firebird legado

A migração será repetível e reconciliável, nunca uma cópia direta de tabelas para o novo schema.

### Descoberta segura

- identificar versão do Firebird, dialect, charset, tamanho e dependências do arquivo;
- obter backup ou cópia consistente com o sistema legado parado ou por ferramenta apropriada;
- nunca experimentar sobre o único arquivo ativo da operação;
- catalogar tabelas, chaves reais, códigos duplicados, campos livres e dados inválidos;
- registrar consultas de contagem e totais para reconciliação.

### Escopo inicial

Importar primeiro somente o necessário para operar a Fase 8:

- parceiros ativos relevantes ao recebimento;
- produtos ativos e seus códigos legados;
- unidades, classificações e saldos iniciais verificáveis;
- vínculos de código do fornecedor quando existirem.

Histórico fiscal deve ser recuperado preferencialmente de XMLs confiáveis, inclusive da SIEG. Não se
deve migrar vinte anos de tabelas operacionais sem um caso de uso definido. Títulos em aberto,
vendas e compras históricas pertencem aos planos das fases correspondentes.

### Processo

```text
cópia consistente -> extração somente leitura -> staging -> validação/mapeamento
                  -> importação idempotente -> reconciliação -> relatório de divergências
```

Cada execução gera versão, contagens, rejeições e checksums. O saldo inicial entra como movimento de
abertura auditado e só é aceito após reconciliação com o inventário operacional.

## Segurança e auditoria

- Credenciais da SIEG, Firebird, certificados digitais e arquivos PFX não entram no Git nem em logs.
- Visualização e download de XML ou certificado exigem permissão e tenant autenticado.
- Importação, mapeamento, confirmação, ajuste e download relevante produzem auditoria estruturada.
- Dados pessoais são minimizados nas telas, logs e ambientes não produtivos.
- Nenhuma IA confirma recebimento, altera classificação fiscal ou cria movimento crítico sem
  validação determinística, autorização e auditoria.

## Fora do escopo

- emissão de NF-e ou NFC-e;
- orçamento, pedido, tabela de preço e reserva;
- venda, devolução e faturamento;
- contas a pagar ou receber;
- apuração de tributos, EFD, ECD ou ECF;
- custeio contábil definitivo;
- rastreabilidade garantida por lote ou corrida;
- migração integral de todo o histórico do legado;
- geração automática de descrição fiscal por IA sem confirmação.

## Incrementos

### 8.0 — Descoberta e provas

- validar acesso de API da SIEG e baixar documentos em ambiente seguro;
- inventariar o Firebird a partir de cópia consistente;
- coletar amostras anonimizadas das famílias, unidades e certificados;
- obter decisão contábil documentada sobre os documentos fiscais usados na venda atual;
- confirmar depósitos, locais e política operacional de recebimento.

### 8.1 — Parceiros e catálogo

- modelo, migrations, API e telas de parceiros;
- produto, atributos técnicos, apresentações, unidades e conversões;
- mapeamento de códigos de fornecedor;
- testes de isolamento de tenant e CNPJ alfanumérico.

### 8.2 — Caixa de entrada fiscal

- armazenamento seguro de arquivos;
- upload manual e adaptador SIEG;
- parser, validação, hash, proveniência e deduplicação;
- prévia sem efeitos no estoque.

### 8.3 — Recebimento e estoque

- confirmação transacional do recebimento;
- movimentos imutáveis e saldo por depósito;
- ajustes com motivo e auditoria;
- reconciliação e testes concorrentes/idempotentes.

### 8.4 — Certificados e carga inicial

- armazenamento e vínculo de certificados;
- pesquisa e recuperação por entrada e produto;
- importação repetível do escopo aprovado do Firebird;
- relatório de divergências e saldo inicial reconciliado.

## Critérios de aceitação

- O mesmo XML, pela SIEG ou upload, nunca duplica documento ou estoque.
- XML inválido, não autorizado ou destinado a outra empresa não gera recebimento.
- Nenhuma quantidade fracionária ou valor monetário usa ponto flutuante.
- Uma conversão variável preserva valores de origem, fator efetivo e responsável.
- É possível chegar do saldo ao movimento, ao recebimento, ao item e ao XML original.
- Certificados podem ser recuperados sem afirmar rastreabilidade inexistente.
- Ajustes não apagam movimentos anteriores.
- Consultas e arquivos permanecem isolados por organização.
- A carga Firebird pode ser reexecutada e produz reconciliação equivalente.
- OpenAPI e cliente gerado são atualizados junto com o contrato.
- Formatação, lint, TypeScript strict, testes pertinentes e `pnpm verify` passam.

## Questões que bloqueiam decisões específicas, mas não o início da descoberta

- Quais famílias e atributos técnicos existem de fato no catálogo atual?
- Qual unidade representa melhor o saldo de cada família?
- Quais conversões são fixas e quais dependem de pesagem ou medição real?
- Há corte, sobra reaproveitável, perda ou transformação interna?
- Certificados trazem lote, corrida, norma e composição em formato consistente?
- Quantos depósitos e localizações físicas precisam ser controlados?
- Qual versão, charset e estrutura do Firebird legado?
- O contrato SIEG atual inclui API, qual sua cota e qual período de retenção?
- A operação de varejo atual exige NFC-e ou está enquadrada em fluxo documental diferente? A resposta
  deve vir da contabilidade responsável.

## Referências regulatórias

- [SEFAZ-SP — NFC-e no varejo paulista](https://portal.fazenda.sp.gov.br/servicos/nfce?idServicoCarta=92C73382-61F4-4A34-8387-FD77F49E1557)
- [Receita Federal — orientações da Reforma Tributária para 2026](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/orientacoes-2026)
- [Receita Federal — CNPJ alfanumérico](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/cnpj-alfanumerico)
- [SPED — EFD ICMS/IPI](https://www.gov.br/sped/pt-br/assuntos/escrituracoes-digitais/efd-icms-ipi)
- [ANPD — segurança para agentes de pequeno porte](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-publica-guia-de-seguranca-para-agentes-de-tratamento-de-pequeno-porte)
