# Handoff do projeto para agentes de IA

- Atualizado em: 2026-09-02
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

O schema contém `Partner`, `UnitOfMeasure`, `Product`, `ProductPresentation` e
`SupplierProductMapping`, todos vinculados à organização. Há constraints compostas para evitar
relações entre tenants.

Rotas implementadas:

- `POST /api/v1/partners`;
- `POST /api/v1/catalog/products`;
- `POST /api/v1/catalog/supplier-mappings`;
- `POST /api/v1/catalog/supplier-mappings/resolve`.

Criações exigem `Idempotency-Key`, respeitam RBAC e geram auditoria. A resolução retorna
`MATCHED`, `UNMAPPED` ou `SUPPLIER_NOT_FOUND`.

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
API. A configuração multiempresa, integração com a ingestão e reconciliação ainda não existem.

### Schema da caixa de entrada fiscal

O Prisma contém `InboundFiscalDocument`, `InboundFiscalDocumentItem`,
`FiscalDocumentIngestion` e `InboundFiscalDocumentItemMapping`. As constraints garantem tenant nas
relações, chave de acesso única por organização, decimais exatos, metadados mínimos do objeto e
formatos fiscais básicos. Fornecedor ainda não cadastrado e item ainda não mapeado continuam
representáveis. Não existe serviço de persistência e nenhuma dessas tabelas produz efeito no
estoque.

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

- rotas de leitura e edição de parceiros e catálogo na API: hoje esses módulos expõem apenas `POST`,
  então nenhuma tela de manutenção é possível sem elas;
- telas de listagem, criação e edição dos cadastros;
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

## Próximo passo recomendado

O próximo recorte deve expor leitura de parceiros e catálogo na API: `GET /api/v1/partners` e
`GET /api/v1/catalog/products`, com paginação explícita e limite máximo, filtradas pelo
`organizationId` do contexto autenticado e com teste negativo de isolamento. Sem elas as telas de
manutenção do incremento 8.1 não têm como listar nada. Só depois disso vale construir as telas de
listagem e edição, e em seguida retomar a configuração S3 por organização.

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
