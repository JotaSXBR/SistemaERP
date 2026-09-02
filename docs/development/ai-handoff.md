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

### Armazenamento privado definido

A ADR-0007 define a API S3 como fronteira, serviço S3 compatível configurável por organização e
MinIO no Docker Compose para desenvolvimento e testes. Configuração e onboarding devem validar
endpoint, região, bucket, acesso privado e capacidades antes da ativação; credenciais nunca ficam em
texto aberto ou retornam pela API. Download começa mediado pela API após autorização por tenant. A
implementação do adapter, do MinIO local, da configuração e da reconciliação ainda não existe.

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

- 39 testes da API em 8 arquivos, 2 testes do banco e 2 testes da web;
- formatação e lint;
- TypeScript strict;
- build de todos os workspaces;
- regeneração determinística do OpenAPI e do cliente TypeScript.

A suíte existente também cobre banco, web e um E2E Playwright do diagnóstico. Antes de concluir
qualquer nova entrega, execute `pnpm verify` e o E2E proporcionalmente ao risco. O CI da `main`
repete migrations, formatação, lint, typecheck, testes, build, contrato e Playwright.

## O que ainda falta

Para concluir 8.1:

- telas e manutenção dos cadastros;
- apresentações adicionais e conversões variáveis;
- atributos técnicos e fiscais enriquecidos.

Para 8.2:

- upload manual durável, com armazenamento privado e proveniência;
- persistir documento, itens, hash, proveniência e estados por organização;
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

O próximo recorte deve continuar pequeno: definir o modelo persistente da caixa de entrada fiscal,
incluindo documento, item, proveniência, hash, estados e constraints de tenant/idempotência. A
fronteira de objetos foi definida na ADR-0007; ainda não adicione o adapter ou o MinIO no mesmo PR do
schema. Depois, implemente em PRs separados o MinIO no Compose e a configuração multiempresa do
serviço S3. Não conecte a caixa de entrada ao estoque.

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
