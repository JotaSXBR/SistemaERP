# Handoff do projeto para agentes de IA

- Atualizado em: 2026-09-04
- Branch principal: `main`
- Objetivo: permitir que outro agente retome o desenvolvimento sem reconstruir o contexto por
  tentativa e erro.

## Como usar este documento

Este arquivo é um mapa operacional, não substitui as decisões normativas. Antes de alterar código,
leia, nesta ordem:

1. `AGENTS.md`;
2. `docs/architecture/overview.md`;
3. a convenção da camada afetada em `docs/conventions/`;
4. os ADRs em `docs/decisions/`;
5. `docs/product/phase-8-receiving-inventory.md`;
6. este handoff e o código existente.

Se houver divergência, `AGENTS.md`, ADRs e documentos de arquitetura têm precedência sobre este
resumo. Confirme o estado real com `git status`, `git log` e os testes; não presuma que este arquivo
é mais recente que o código.

## Missão e escopo atual

Estamos construindo a fundação de um ERP web multiempresa. O primeiro fluxo de negócio é a leitura
manual e controlada de XML de NF-e de entrada, seguida pela correspondência determinística entre o
código usado pelo fornecedor e o produto/apresentação internos.

Integrações com SIEG, Firebird ou outros sistemas legados foram retiradas do escopo. Também não há
emissão fiscal, captura automática, financeiro ou movimentação de estoque nesta etapa.

O caminho acordado é:

```text
XML manual
  -> parsing seguro e preservação dos campos originais
  -> identificação do fornecedor
  -> resolução fornecedor + código externo
  -> prévia MATCHED / UNMAPPED / SUPPLIER_NOT_FOUND
  -> validações fiscais e confirmação humana [futuro]
  -> recebimento e movimentos imutáveis de estoque [futuro]
```

Nenhum XML deve produzir estoque antes das validações determinísticas, autorização, auditoria e
confirmação previstas na Fase 8.

## Arquitetura aprovada

- Monorepo TypeScript com pnpm workspaces.
- Monólito modular NestJS/Fastify em `apps/api`.
- React/Vite em `apps/web`.
- PostgreSQL como fonte de verdade e Prisma em `packages/database`.
- OpenAPI gerado pela API e cliente gerado em `packages/contracts`.
- Vitest para testes unitários e de integração; Playwright para poucos fluxos E2E.
- Docker Compose para PostgreSQL e para o E2E isolado.

Não crie microsserviços ou pacotes genéricos por antecipação. Regras de negócio permanecem no
módulo proprietário. `packages/database` contém persistência, não utilitários de domínio.

## Garantias que não podem regredir

- Entidades de negócio multiempresa carregam `organizationId`.
- `organizationId` vem da sessão/contexto autenticado, nunca do corpo da requisição.
- Consultas e constraints relevantes incluem o tenant; testes negativos cobrem isolamento.
- Dinheiro e quantidades exatas não usam `float`; o XML preserva decimais como texto até conversão
  explícita, e o banco usa `numeric`.
- Instantes persistidos usam UTC; datas civis mantêm sua semântica própria.
- Operações reexecutáveis são idempotentes.
- Mudanças relevantes geram auditoria estruturada.
- Migrations aplicadas são imutáveis.
- Artefatos OpenAPI, SDK e cliente Prisma não são editados manualmente.
- IA não confirma recebimento nem grava dados críticos sem validação determinística e autorização.

## Estado implementado

### Fundação da plataforma

As Fases 1 a 7 estão concluídas: configuração validada, PostgreSQL/Prisma, API e web, identidade,
sessão opaca, organizações, memberships, RBAC, contexto de tenant, auditoria imutável e
idempotência. O seed usa somente identidades sintéticas.

### Leitura de NF-e

`apps/api/src/fiscal-intake/nfe-xml.parser.ts`:

- aceita NF-e 4.00 com ou sem `nfeProc`;
- limita o XML a 5 MiB;
- rejeita XML malformado e `DOCTYPE`;
- limita expansão de entidades e profundidade;
- extrai emitente, destinatário, chave, protocolo, datas, total e itens;
- preserva códigos, quantidades e valores decimais como texto;
- calcula SHA-256 sem registrar o conteúdo;
- usa erros estáveis e não inclui dados do XML nas mensagens.

O comando local `pnpm nfe:validate -- <arquivo-ou-diretório>` produz somente métricas minimizadas.
A primeira leitura controlada avaliou 35 XMLs, 204 itens, 22 fornecedores e 190 combinações únicas
de fornecedor/código. GTIN apareceu de forma útil em apenas quatro itens; por isso a chave de
correspondência escolhida foi `fornecedor + código do fornecedor`.

### Parceiros e catálogo

O schema contém `Partner`, `UnitOfMeasure`, `ProductCategory`, `ProductBrand`, `Product`,
`ProductPresentation` e `SupplierProductMapping`, todos vinculados à organização. Há constraints compostas para evitar
relações entre tenants.

Rotas implementadas:

- `GET /api/v1/partners` e `GET /api/v1/partners/{id}`;
- `POST /api/v1/partners` e `PATCH /api/v1/partners/{id}`;
- `GET /api/v1/catalog/products` e `GET /api/v1/catalog/products/{id}`;
- `POST /api/v1/catalog/products` e `PATCH /api/v1/catalog/products/{id}`;
- `GET /api/v1/catalog/categories`, `POST` e `PATCH /api/v1/catalog/categories/{id}`;
- `GET /api/v1/catalog/brands`, `POST` e `PATCH /api/v1/catalog/brands/{id}`;
- `POST /api/v1/catalog/supplier-mappings`;
- `POST /api/v1/catalog/supplier-mappings/resolve`.

Criações e atualizações exigem `Idempotency-Key`, respeitam RBAC e geram auditoria. A resolução
retorna `MATCHED`, `UNMAPPED` ou `SUPPLIER_NOT_FOUND`.

`PATCH /api/v1/catalog/products/{id}` altera `active`, `shortDescription`, `technicalDescription`,
`categoryId` e `brandId`, devolvendo o mesmo detalhe do `GET`; string vazia em
`technicalDescription` remove o texto e `null` em `categoryId`/`brandId` remove o vínculo.

A classificação segue a ADR-0008: `ProductCategory` é uma taxonomia auto-relacionada por tenant
(família, grupo e subgrupo na mesma árvore, no máximo cinco níveis) e `ProductBrand` fica fora dela.
O `code` de ambos é imutável; `PATCH` aceita só `name` e `active` e rejeita `parentId` com `400`,
porque reparentar exigiria recalcular a subárvore. `GET /api/v1/catalog/products?categoryId=...`
inclui os produtos das categorias descendentes. SKU e unidade base são deliberadamente imutáveis: apresentações e mapeamentos de
fornecedor os referenciam, e trocá-los reescreveria o significado de dados já persistidos. Uma
troca real de SKU ou de unidade é decisão de negócio e precisa de um recorte próprio.

As leituras estão liberadas para qualquer membro autenticado, porque listar cadastros não é operação
privilegiada; escrita continua restrita a `OWNER` e `ADMIN`. Elas usam paginação explícita
`limit`/`offset` (`limit` padrão 20 e máximo 100, em `apps/api/src/pagination/pagination.ts`) e
devolvem `items`, `limit`, `offset` e `total`. Parceiros aceitam os filtros `search` (razão social,
nome fantasia ou identificador fiscal normalizado), `role` e `active`; produtos aceitam `search`
(SKU ou descrição curta) e `active`. A ordenação acompanha os índices existentes: parceiros por
`legalName` e produtos por `shortDescription`, ambos com `id` como desempate estável. O detalhe de
produto devolve a unidade base e todas as apresentações, antecipando as apresentações adicionais do
incremento 8.1. Parâmetro inválido responde `400`; recurso de outra organização responde `404`.

`normalizeTaxId` pertence ao módulo `partners` e é reutilizado pelo catálogo. A normalização de
SKU, unidade e código de fornecedor continua encapsulada no catálogo porque essas semânticas podem
divergir futuramente.

### Autenticação e sessão na web

A aplicação web deixou de ser somente a página de diagnóstico. O cliente gerado passou a receber o
token opaco da sessão pela opção `auth`, então toda rota com `security` no contrato é assinada
automaticamente; nenhuma tela monta cabeçalho `Authorization` por conta própria.

- `/login` autentica com e-mail, senha e identificador da empresa e devolve o usuário à rota que ele
  tentou abrir.
- O token vive em memória e é espelhado em `sessionStorage`, não em `localStorage`: a credencial não
  fica disponível a outras abas nem sobrevive ao fechamento do navegador. Bloqueio de armazenamento
  degrada para sessão apenas em memória.
- Um `401` em qualquer resposta descarta o token no cliente, de modo que sessão expirada ou revogada
  no servidor deixa de valer também na interface.
- `RequireSession` protege rotas autenticadas e distingue os estados carregando, anônimo e
  autenticado. `/diagnostics` permanece público porque expõe apenas os health checks, que são rotas
  `@Public`.
- Sair revoga a sessão no servidor e remove do cache do TanStack Query tudo que não seja a própria
  sessão, para que dados de um tenant não sobrevivam à troca de usuário no mesmo navegador.
- `/organization` é a primeira tela autenticada e mostra a empresa da sessão e o papel do usuário.

Formulários usam React Hook Form e Zod, conforme `docs/conventions/frontend.md`. A API continua
sendo a autoridade de validação; o schema do cliente evita apenas a ida desnecessária ao servidor.

### Prévia de ingestão

`FiscalIntakeService.preview(xml)` já combina o parser com a resolução em lote do catálogo:

- consulta o fornecedor uma vez;
- consulta os mapeamentos dos códigos em lote;
- mantém ordem e campos originais dos itens;
- anexa a resolução determinística a cada item;
- soma `matched`, `unmapped` e `supplierNotFound`;
- não persiste documento, não grava arquivo e não altera estoque.

`POST /api/v1/fiscal-intake/nfe/previews` expõe essa prévia a usuários autenticados. A rota recebe
somente `application/xml` ou `text/xml`, limita o corpo a 5 MiB e não registra o conteúdo em logs.
Ela ainda não persiste documento, arquivo ou proveniência e não produz qualquer efeito no estoque.

### Ingestão persistente e resolução guiada

`POST /api/v1/fiscal-intake/nfe/ingestions` recebe os bytes do XML com `Idempotency-Key` e exige
`OWNER` ou `ADMIN`. O serviço:

- rejeita XML não parseável antes da inbox;
- calcula o hash sobre os bytes originais;
- grava e verifica o objeto privado antes do PostgreSQL;
- persiste documento, itens, ingestão e mappings já conhecidos em transação serializável;
- deriva `PENDING_SUPPLIER`, `PENDING_MAPPING` ou `READY_FOR_REVIEW`;
- audita a ingestão sem colocar conteúdo fiscal sensível nos metadados.

O hash da chave de idempotência é persistido por organização. A chave de acesso oferece a
deduplicação permanente; a mesma chave com XML de hash diferente retorna conflito. Reimportar o
mesmo XML retorna o documento existente com `replayed: true`.

Fornecedor pendente pode significar parceiro inexistente, inativo ou sem papel `SUPPLIER`. O
endpoint idempotente `PATCH /api/v1/partners/{id}` permite atualizar `active` e `roles` com auditoria.
Depois do cadastro do fornecedor, produto ou mapping,
`POST /api/v1/fiscal-intake/nfe/documents/{documentId}/resolve` materializa apenas os snapshots ainda
ausentes em `InboundFiscalDocumentItemMapping` e atualiza o status. O endpoint não altera o XML nem
produz estoque.

Cada item preserva o grupo `imposto` declarado pelo emitente em `InboundFiscalDocumentItemTax`,
conforme a ADR-0009: ICMS (CST ou CSOSN, origem, base, alíquota, redução, ST e cBenef), IPI, PIS,
COFINS e o grupo `IBSCBS` da NT 2025.002 quando presente. É transcrição, não cálculo, e campos
ausentes permanecem ausentes em vez de virar zero. O que não está projetado em coluna continua
recuperável no XML original preservado no object storage.

`GET /api/v1/fiscal-intake/nfe/documents` lista os 50 documentos recentes usados pela tela e
`GET /api/v1/fiscal-intake/nfe/documents/{documentId}` recupera a prévia persistente. Ambas as
consultas derivam o tenant da sessão.

### Identidade fiscal e validação do destinatário

`PATCH /api/v1/organizations/current/fiscal-identity` permite ao `OWNER` configurar o CPF/CNPJ
fiscal normalizado da organização com idempotência e auditoria. O identificador pertence ao tenant
autenticado; `organizationId` no payload é rejeitado.

Prévia, ingestão e resolução comparam deterministicamente o destinatário do XML com essa identidade.
Ausência de configuração produz `ORGANIZATION_TAX_ID_NOT_CONFIGURED`; divergência produz
`RECIPIENT_TAX_ID_MISMATCH`. A ingestão preserva o XML e os motivos na inbox com
`VALIDATION_FAILED`, mas não materializa mappings de itens. Depois de corrigir a identidade, a ação
explícita de resolução revalida o documento e só então permite avançar para fornecedor/mapping ou
`READY_FOR_REVIEW`. A web exibe os motivos e bloqueia o mapping enquanto a falha persistir.

Esta fatia não valida schema XSD oficial, assinatura XML, protocolo nem reconciliação de totais.

### Inbox fiscal na web

A rota autenticada `/fiscal-intake` usa exclusivamente o cliente OpenAPI gerado e TanStack Query
para o estado remoto. Ela permite:

- selecionar e enviar XML de até 5 MiB;
- reabrir documentos persistidos depois de recarregar a página;
- resolver parceiro ausente, inativo ou sem papel `SUPPLIER`;
- selecionar produto/apresentação ou criar o produto mínimo;
- criar o mapping e reavaliar o documento até `READY_FOR_REVIEW`.

Os formulários usam React Hook Form e Zod, e os drawers têm semântica de diálogo, fechamento por
teclado e foco inicial. `MEMBER` permanece em modo de consulta. A tela não simula recebimento nem
estoque: quando o documento fica pronto, informa que essa ação pertence à Fase 8.3.

### Armazenamento privado e MinIO local

A ADR-0007 define a API S3 como fronteira e serviço S3 compatível configurável por organização. O
Docker Compose oferece MinIO local com imagem fixada, volume nomeado, health check e provisionamento
idempotente de um bucket privado e versionado. O módulo `fiscal-intake` contém uma porta
`put/head/get` e um adapter S3 baseado no cliente modular AWS SDK v3. O `put` é condicional e trata
retry do mesmo conteúdo de forma idempotente; tamanho, tipo e SHA-256 são verificados no `head/get`.
O teste de contrato opt-in roda contra o MinIO com `pnpm test:s3:integration`. A dependência do SDK
evita implementar autenticação SigV4, retries, streams e checksums manualmente e fica restrita ao
workspace da API. Configuração e onboarding ainda devem validar endpoint, região, bucket, acesso
privado e capacidades antes da ativação; credenciais nunca ficam em texto aberto ou retornam pela
API. O Compose provisiona uma credencial local de aplicação separada da credencial root, limitada
ao bucket privado por policy própria, e a ingestão usa o adapter em desenvolvimento. Em
`NODE_ENV=production`, o provider retorna `503` até existir configuração persistente por
organização. Essa configuração e a reconciliação de objetos órfãos ainda não existem.

### Schema da caixa de entrada fiscal

O Prisma contém `InboundFiscalDocument`, `InboundFiscalDocumentItem`,
`FiscalDocumentIngestion` e `InboundFiscalDocumentItemMapping`. As constraints garantem tenant nas
relações, chave de acesso única por organização, decimais exatos, metadados mínimos do objeto e
formatos fiscais básicos. Fornecedor ainda não cadastrado e item ainda não mapeado continuam
representáveis. O serviço de ingestão e resolução já grava essas tabelas; nenhuma delas produz
efeito no estoque.

## Próximas etapas recomendadas

1. Validar protocolo, totais, schema oficial e assinatura antes de permitir recebimento; a
   identidade fiscal e o destinatário já estão cobertos, e o snapshot fiscal por item já fornece os
   valores declarados necessários à reconciliação de totais.
2. Implementar configuração persistente e seleção de storage por organização, download autenticado
   do XML e reconciliação segura de objetos órfãos.
3. Concluir apresentações/conversões do catálogo necessárias aos itens reais e as telas de criação
   de parceiros e catálogo; listagem e edição de ambos já estão publicadas na web.
4. Somente depois implementar `receive`, depósitos e movimentos imutáveis da Fase 8.3.

## Mapa do código relevante

```text
apps/api/src/partners/              cadastro e normalização de identificador fiscal
apps/api/src/catalog/               produtos, apresentações e mapeamentos do fornecedor
apps/api/src/fiscal-intake/         parser XML e serviço interno de prévia
apps/api/tests/                      testes unitários e integração HTTP/PostgreSQL
apps/api/tests/fixtures/             somente XML sintético
packages/database/prisma/           schema e migrations imutáveis
packages/contracts/openapi/         contrato OpenAPI gerado
packages/contracts/src/generated/   SDK gerado; nunca editar manualmente
docs/product/phase-8-receiving-inventory.md  escopo funcional vigente
```

## Dados reais e segurança

XMLs reais permanecem em `files/` ou `.local-data/`, ambos fora do Git. Eles podem conter dados
pessoais, chaves de acesso, endereços e valores comerciais.

Regras obrigatórias:

- nunca copiar XML real para fixture, documentação, prompt, log ou relatório versionado;
- nunca exibir nomes, documentos, descrições, chaves ou valores reais em saídas de ferramentas;
- testes automatizados usam `apps/api/tests/fixtures/nfe-synthetic.xml`;
- `.dockerignore` exclui `.env`, `files/`, `.local-data/`, dependências, builds e relatórios;
- não alegar validade de assinatura para XML anonimizado;
- não armazenar o original no PostgreSQL como solução definitiva: a Fase 8 prevê objeto privado S3
  compatível e somente metadados/hash/vínculos no banco.

## Ambiente e execução

Versões principais estão fixadas no repositório: Node 24, pnpm 11, PostgreSQL 18 e imagem oficial do
Playwright na mesma versão da dependência do projeto.

Bootstrap local:

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm infra:up
pnpm db:migrate:deploy
pnpm db:seed
```

Comandos de validação:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm contracts:check
pnpm verify
```

No WSL, prefira o E2E isolado:

```bash
pnpm test:e2e:docker
```

Esse comando constrói `Dockerfile.e2e`, usa a imagem oficial do Playwright, aplica migrations e
executa API, web e navegador na rede privada do Compose. Não monte o workspace no contêiner E2E:
isso já causou alteração de propriedade em `node_modules` e criação de cache local como `root`. A
implementação atual usa `COPY` e dependências isoladas na imagem.

Quando o contrato HTTP mudar:

```bash
pnpm contracts:generate
pnpm contracts:check
```

Revise e versione juntos OpenAPI e cliente gerado. Mudanças internas no serviço de prévia não
exigem regeneração enquanto não houver controller/DTO público.

## Estado recente dos testes

Na implementação da prévia HTTP, `pnpm verify` validou:

- 39 testes da API em 8 arquivos, 5 testes do banco e 2 testes da web;
- formatação e lint;
- TypeScript strict;
- build de todos os workspaces;
- regeneração determinística do OpenAPI e do cliente TypeScript.

A suíte existente também cobre banco, web e um E2E Playwright do diagnóstico. Valide cada entrega
proporcionalmente ao risco conforme `AGENTS.md`; `pnpm verify` permanece obrigatório para mudanças
críticas ou transversais, não para docs-only. O CI executa a suíte completa quando há arquivo não
Markdown e somente uma checagem leve do diff para documentação. O agente não aguarda ativamente o
CI remoto depois de abrir ou atualizar um PR.

## O que ainda falta

Para concluir 8.1:

- telas de criação dos cadastros; listagem e edição de parceiros e produtos já existem;
- telas de taxonomia e marcas na web: a API existe, a interface ainda não;
- reparentar categoria e renomear código, deliberadamente fora da ADR-0008;
- atributos fiscais (NCM, CEST, origem, GTIN, perfil com vigência) e geometria, cada um com ADR
  próprio;
- edição de apresentações do produto, ainda sem rota própria;
- apresentações adicionais e conversões variáveis;
- atributos técnicos e fiscais enriquecidos.

Para 8.2:

- upload manual durável, com armazenamento privado e proveniência;
- deduplicar por `organizationId + chave de acesso` e tratar reimportação idempotente;
- validar schema XSD oficial, assinatura, protocolo, destinatário e totais;
- expor a prévia autenticada sem efeitos no estoque;
- registrar auditoria de importação, revisão e mapeamento.

Para 8.3, somente depois das validações anteriores:

- depósitos/localizações;
- confirmação humana transacional;
- movimentos imutáveis e saldo derivado;
- certificados de qualidade e limitações explícitas de rastreabilidade.

## Questões respondidas pelo proprietário

As perguntas que travavam a modelagem foram respondidas em 2026-09-04 (18 de 18). O levantamento
completo está em [`docs/product/steel-distribution-domain.md`](../product/steel-distribution-domain.md);
as decisões que ele destrava estão na
[ADR-0010](../decisions/ADR-0010-product-attributes-and-geometry.md).

O essencial para quem retoma o trabalho:

- **Os eixos de classificação variam por linha de produto.** Aço carbono tem liga e processo,
  alumínio tem liga e têmpera, tubo tem schedule, bronze tem composição. Não são três eixos fixos,
  e usuários com permissão devem poder criar eixos novos sem alteração de sistema. A ADR-0010
  resolve isso com facetas tipadas **ao lado** da taxonomia da ADR-0008, que permanece válida.
- **A medida entra em cálculo.** O preço sai de `comprimento × peso/m × preço/kg`. Medida é número
  com unidade, persistido em milímetro; polegada é apresentação convertida na interface. Peso
  teórico é informado no cadastro, não derivado por fórmula.
- **Rastreabilidade por lote está fora de escopo** por decisão do proprietário. O estoque pode ser
  saldo derivado de movimentos imutáveis sem identidade de lote. Certificados de qualidade também
  são futuro.
- **O prazo de 4 de janeiro de 2027 não é urgência deste projeto.** O legado já emite com IBS e CBS
  e já resolveu o cBenef com a equivalência NCM fornecida pela contabilidade. A emissão no sistema
  novo não tem prazo e será feita por **API de terceiros**, com prestador ainda não escolhido.
- **Não existe controle de estoque hoje**, apenas um balanço anual em peso. Não há processo legado
  a replicar; o desenho será do zero e o proprietário pediu apoio nele.
- **~5.800 itens do catálogo legado** precisarão ser importados e reorganizados. A importação é
  recorte próprio e não deve contaminar o cadastro manual.

### O que não replicar do sistema legado

O legado guarda como coluna o que deveria ser derivado ou versionado. Não repita:

- `Estoque Atual`, `Custo Médio` e `Custo Reposição`: derivados de movimentos imutáveis;
- `Data Última Entrada` e `Data Última Saída`: derivadas do histórico;
- `Detalhes` ("1020 FORJADO REDONDO 12\""): concatenação das facetas gravada como texto; deve ser
  gerada na exibição;
- `Referência` (83010101111): código inteligente que embute grupo, tipo, modelo e medida; quebra
  quando a classificação muda. O SKU permanece opaco;
- `Preço` único no produto: preço real exige tabela com vigência.

## Próximo passo recomendado

As telas de cadastro estão completas nas duas pontas: `/partners` e `/products` listam, editam e
criam, com busca no servidor, filtros, paginação e estados de carregamento, erro e vazio. Escrita
em drawers restritos a `OWNER` e `ADMIN`, sempre com `Idempotency-Key`.

A **primeira metade da ADR-0010: facetas tipadas** está feita. `ProductAttributeDefinition`,
`ProductAttributeOption` e `ProductAttributeValue` seguem o padrão de `ProductCategory` e
`ProductBrand` — `code` imutável por organização, `PATCH` de `name` e `active`, `onDelete: Restrict`,
escrita restrita a `OWNER` e `ADMIN`. As facetas são atribuídas ao produto no `PATCH` de produto e
aparecem em `ProductDetailDto`. Cuidado com o histórico: esse recorte foi mergeado por engano na
branch `docs/catalog-attributes` (PR #33) e só chegou a `main` pelo PR #34.

A **geometria (segunda metade da ADR-0010)** também está feita: oito colunas `numeric(24, 10)`
nulas no produto — espessura, largura, altura, diâmetro externo e interno, comprimento, peso por
metro e peso por metro quadrado. Dimensões sempre em milímetro e pesos em quilograma; medida
ausente da resposta significa "não se aplica", nunca zero. O `PATCH` de produto atualiza medida a
medida, `null` limpa, e a auditoria registra quais medidas mudaram de fato (comparação decimal, não
textual). Os valores trafegam como string decimal para não passar por ponto flutuante.

Duas lacunas conhecidas, ambas deliberadas: o `POST` de produto ainda não aceita facetas nem
geometria — cadastrar e depois classificar/medir exige um `PATCH` —, e a interface web ainda não
expõe nenhum dos dois. A conversão polegada↔milímetro é apresentação e mora na interface, que
ainda não a tem.

## Padrão de SKU — decisão pendente

O SKU é hoje um código livre: a API só exige `CODE_PATTERN` (letras, dígitos, `-._/`, até 120
caracteres), normaliza para maiúsculas e garante unicidade por organização. Não há padrão de
formação, e o proprietário decidiu que vai haver um.

**Insumo já analisado**: as quatro planilhas do proprietário foram lidas e o levantamento está em
[`sku-legacy-analysis.md`](../product/sku-legacy-analysis.md) — 419 produtos, o padrão em uso
(`MATERIAL-FORMA-TIPO-MEDIDA`), as seis divergências encontradas e as cinco perguntas que a ADR
precisa responder. A análise também confirmou a fórmula de preço real do negócio e validou o
mapeamento das colunas para as facetas e a geometria da ADR-0010.

Enquanto isso não chega, **não invente um padrão de SKU** nem acrescente validação de formato — a
planilha é a evidência de como o negócio já nomeia as coisas, e decidir antes de vê-la é decidir no
escuro. Vale notar a tensão já registrada neste documento: o legado usa uma `Referência` inteligente
(83010101111) que embute grupo, tipo, modelo e medida e **quebra quando a classificação muda**. Um
padrão novo precisa dizer explicitamente se o SKU carrega significado ou permanece opaco — e a
ADR-0010 já deu ao catálogo os mecanismos (facetas e geometria) para que o significado não precise
morar dentro do código.

Quando as planilhas chegarem, o recorte é: ler as fórmulas, propor o padrão em ADR própria e só
então mexer em validação.

Os próximos recortes são as apresentações com conversão variável, a configuração S3 por
organização e as validações fiscais restantes.

A importação dos ~5.800 itens do legado é recorte próprio e depende das duas metades da ADR-0010.

Os dois advisories transitivos do Prisma (`deepmerge-ts` e `mysql2`) foram resolvidos por `overrides`
no `pnpm-workspace.yaml`. Cada entrada tem comentário com o advisory e deve ser removida quando o
Prisma passar a resolver a versão corrigida sozinho; confirme com `pnpm audit --prod` ao mexer nessas
dependências.

Ao retomar, confirme que a árvore está limpa e que o CI do último commit está verde. Se houver
alterações não versionadas, inspecione-as antes de editar; elas pertencem ao usuário ou ao agente
anterior.

## Prompt curto para retomada

```text
Leia AGENTS.md e docs/development/ai-handoff.md integralmente. Depois confira git status, os ADRs e
docs/product/phase-8-receiving-inventory.md. Retome a Fase 8 sem SIEG/Firebird. Preserve tenant,
idempotência, auditoria, decimais exatos e XMLs reais fora do Git. O serviço interno de prévia já
faz parsing e resolução em lote sem persistência ou estoque. Proponha e implemente apenas o próximo
recorte pequeno, execute pnpm verify e Playwright no Docker quando pertinente, e informe exatamente
o que foi e não foi validado.
```
