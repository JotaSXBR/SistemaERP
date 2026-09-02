# Fase 8 — Catálogo, entrada fiscal e estoque rastreável

- Estado: Em andamento — 8.1 parcial / 8.2 schema persistente
- Data da definição: 2026-08-31
- Predecessora: Fase 7 — Primitivas de plataforma

## Objetivo

Entregar a primeira funcionalidade de negócio do ERP: receber documentos fiscais de compra,
relacionar os itens dos fornecedores a um catálogo enriquecido e produzir saldo de estoque
auditável.

O fluxo começa pela importação manual e controlada de XMLs de NF-e de entrada e prepara os dados que
alimentarão vendas, compras, financeiro e obrigações fiscais nas fases seguintes.

## Contexto confirmado

- A operação comercializa metais e ferragens no atacado e no varejo.
- Um mesmo material pode ser vendido em apresentação, dimensão e unidade solicitadas pelo cliente.
- Há certificados de qualidade para a maioria dos produtos, mas ainda não há controle formal por
  lote, corrida ou rastreabilidade até a saída.
- A empresa não usa NFC-e atualmente. A aplicabilidade da NFC-e à operação real deve ser validada
  com a contabilidade antes da Fase 10.
- A data de abertura é um fato cadastral distinto das alterações posteriores de sócios, natureza ou
  atividade. O modelo não deve condensar esses fatos em uma única data de situação.

Nenhum identificador, endereço, certificado ou dado real da empresa deve ser incluído em fixtures,
seeds, documentação de exemplo ou testes.

## Resultado operacional

Ao concluir a fase, um usuário autorizado deve conseguir:

1. fornecer manualmente o XML de uma NF-e de entrada;
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
- códigos usados por fornecedores e integrações externas futuras.

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

Correspondências confirmadas são reutilizadas em novas entradas do mesmo fornecedor. Se o código do
fornecedor for novo, tiver mudado ou apontar para mais de uma apresentação possível, o item permanece
pendente até confirmação humana. O texto, código, unidade e quantidades originais do XML nunca são
substituídos pelos dados internos do catálogo.

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

Todo XML fornecido manualmente passa pelo mesmo pipeline idempotente. A origem, o hash e o instante
de ingestão são registrados como proveniência.

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
upload manual de XML
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

## Amostras de produção e testes de ingestão

XMLs reais de NF-e de entrada podem ser usados somente em execução local ou ambiente controlado,
com acesso restrito e sem copiar identificadores, endereços, chaves de acesso, certificados ou
outros dados reais para Git, fixtures, documentação, relatórios de teste ou logs.

O primeiro ciclo de descoberta deve:

1. selecionar amostras representativas das famílias, unidades e formas de apresentação compradas;
2. executar a leitura sem efeitos em estoque e registrar somente métricas e divergências
   minimizadas;
3. identificar os campos efetivamente usados para reconhecer fornecedor, item, unidade, quantidade,
   classificação e valores;
4. produzir fixtures sintéticas ou anonimizadas que preservem as estruturas necessárias aos testes
   automatizados, sem alegar validade de assinatura depois da anonimização;
5. cobrir XML válido, duplicado, malformado, de outro destinatário e com item ainda não mapeado.

O XML de produção valida a compatibilidade do parser em ambiente controlado. A suíte automatizada
deve ser reexecutável sem depender de dados de produção.

A primeira leitura controlada confirmou que GTIN não está disponível de forma suficiente para ser a
chave primária de correspondência. A combinação `fornecedor + código do fornecedor` apresentou
estabilidade maior, embora o texto descritivo possa variar entre documentos. Portanto, descrição,
NCM, GTIN e unidade ajudam na conferência, mas não substituem a associação explícita e auditada.

Essa leitura prova compatibilidade estrutural com as amostras, não validade fiscal completa. A
validação de schema oficial, assinatura, protocolo, destinatário e demais regras fiscais permanece
obrigatória antes de qualquer efeito no estoque.

Para uma validação local minimizada, o arquivo pode permanecer fora do repositório ou em
`.local-data/` e ser lido com `pnpm nfe:validate -- <caminho-do-xml>`. O comando não exibe chave de
acesso, identificadores fiscais, nomes, descrições ou valores. O caminho também pode apontar para um
diretório; nesse caso, o resultado apresenta somente contagens, versões e unidades agregadas.

## Arquivos e armazenamento

XMLs e certificados criam o primeiro uso real para armazenamento de objetos previsto na
arquitetura. A implementação deve:

- manter metadados, vínculo, estado, tamanho e hash no PostgreSQL;
- guardar o conteúdo em serviço S3 compatível configurado por organização e usar MinIO local,
  conforme a ADR-0007;
- criptografar em trânsito e em repouso;
- negar URLs públicas e usar autorização por organização;
- verificar tipo, tamanho e conteúdo antes de aceitar upload;
- ter política de backup, retenção e restauração testada;
- não depender da retenção exclusiva de qualquer sistema externo ou futuro emissor fiscal.

A escolha definitiva do backend e sua operação devem ser registradas antes de adicionar a
dependência. Armazenar temporariamente não pode significar descartar o original após o recebimento.

## Segurança e auditoria

- XMLs de produção, certificados digitais, arquivos PFX, segredos e dados pessoais reais não entram
  no Git nem em logs.
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
- integração automática para captura de documentos fiscais;
- migração ou sincronização de sistemas legados;
- geração automática de descrição fiscal por IA sem confirmação.

## Incrementos

### 8.0 — Descoberta e provas

- validar a leitura controlada de amostras representativas de XMLs de entrada da operação;
- derivar fixtures sintéticas ou anonimizadas para os testes automatizados;
- levantar famílias, unidades, códigos de fornecedor, conversões e certificados encontrados;
- confirmar depósitos, locais e política operacional de recebimento.

### 8.1 — Parceiros e catálogo

- modelo, migrations, API e telas de parceiros;
- produto, atributos técnicos, apresentações, unidades e conversões;
- mapeamento de códigos de fornecedor;
- testes de isolamento de tenant e CNPJ alfanumérico.

Primeira fatia implementada:

- parceiros com papel de fornecedor e CPF/CNPJ normalizado;
- unidade base, produto e apresentação-base com fator decimal exato;
- correspondência única por organização, fornecedor e código externo normalizado;
- resolução determinística em estados `MATCHED`, `UNMAPPED` ou `SUPPLIER_NOT_FOUND`;
- criação idempotente, RBAC, auditoria e isolamento de tenant testados;
- leitura paginada e filtrada de parceiros e produtos, com detalhe por identificador, restrita à
  organização do contexto autenticado.

Telas, apresentações adicionais, atributos técnicos e edição dos cadastros permanecem pendentes para
concluir o incremento 8.1.

### 8.2 — Caixa de entrada fiscal

- armazenamento seguro de arquivos;
- upload manual de XML;
- parser, validação, hash, proveniência e deduplicação;
- prévia sem efeitos no estoque.

Prévia HTTP implementada: `POST /api/v1/fiscal-intake/nfe/previews` recebe XML bruto autenticado com
limite de 5 MiB e combina o documento parseado com a resolução em lote dos códigos do fornecedor,
preservando os campos originais de cada item e resumindo os estados `MATCHED`, `UNMAPPED` e
`SUPPLIER_NOT_FOUND`. Armazenamento privado, proveniência e persistência idempotente continuam
pendentes; essa prévia ainda não produz efeitos no estoque.

A ADR-0007 definiu a fronteira S3, configuração do serviço por organização no sistema e no
onboarding futuro. O Docker Compose já fornece MinIO local com bucket privado, versionado e
provisionado de forma idempotente. A porta interna e o adapter S3 já implementam e testam as
operações `put/head/get`, inclusive retry idempotente e validação do SHA-256. A configuração
persistente por organização ainda não foi implementada.

O schema persistente da caixa de entrada contém documento, itens, ingestões e vínculos opcionais
com apresentações internas. Chave de acesso, objetos e relações são isolados por organização;
quantidades e valores usam `numeric`; a ingestão preserva origem, SHA-256, tamanho, tipo de conteúdo,
chave/versão do objeto e correlação. Os estados atuais cobrem validação pendente ou falha, mapeamento
pendente e documento pronto para revisão. Ainda não há serviço que grave esses modelos.

### 8.3 — Recebimento e estoque

- confirmação transacional do recebimento;
- movimentos imutáveis e saldo por depósito;
- ajustes com motivo e auditoria;
- reconciliação e testes concorrentes/idempotentes.

### 8.4 — Certificados e validação operacional

- armazenamento e vínculo de certificados;
- pesquisa e recuperação por entrada e produto;
- validação controlada com amostras representativas da operação;
- relatório de divergências do mapeamento e estoque reconciliado.

## Critérios de aceitação

- O mesmo XML reenviado nunca duplica documento ou estoque.
- XML inválido, não autorizado ou destinado a outra empresa não gera recebimento.
- Nenhuma quantidade fracionária ou valor monetário usa ponto flutuante.
- Uma conversão variável preserva valores de origem, fator efetivo e responsável.
- É possível chegar do saldo ao movimento, ao recebimento, ao item e ao XML original.
- Certificados podem ser recuperados sem afirmar rastreabilidade inexistente.
- Ajustes não apagam movimentos anteriores.
- Consultas e arquivos permanecem isolados por organização.
- Os testes automatizados de ingestão não dependem de arquivos ou dados reais de produção.
- OpenAPI e cliente gerado são atualizados junto com o contrato.
- Formatação, lint, TypeScript strict, testes pertinentes e `pnpm verify` passam.

## Questões que bloqueiam decisões específicas, mas não o início da descoberta

- Quais famílias e atributos técnicos existem de fato no catálogo atual?
- Qual unidade representa melhor o saldo de cada família?
- Quais conversões são fixas e quais dependem de pesagem ou medição real?
- Há corte, sobra reaproveitável, perda ou transformação interna?
- Certificados trazem lote, corrida, norma e composição em formato consistente?
- Quantos depósitos e localizações físicas precisam ser controlados?
- A operação de varejo atual exige NFC-e ou está enquadrada em fluxo documental diferente? A resposta
  deve vir da contabilidade responsável.

## Referências regulatórias

- [SEFAZ-SP — NFC-e no varejo paulista](https://portal.fazenda.sp.gov.br/servicos/nfce?idServicoCarta=92C73382-61F4-4A34-8387-FD77F49E1557)
- [Receita Federal — orientações da Reforma Tributária para 2026](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/orientacoes-2026)
- [Receita Federal — CNPJ alfanumérico](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/cnpj-alfanumerico)
- [SPED — EFD ICMS/IPI](https://www.gov.br/sped/pt-br/assuntos/escrituracoes-digitais/efd-icms-ipi)
- [ANPD — segurança para agentes de pequeno porte](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-publica-guia-de-seguranca-para-agentes-de-tratamento-de-pequeno-porte)
