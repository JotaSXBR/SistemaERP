# Ambiente de desenvolvimento

## Ambiente-alvo

- Windows com WSL2 e Ubuntu, ou Linux/macOS equivalente;
- Node.js 24.16.0, fixado em `.nvmrc`;
- pnpm 11.24.0 via Corepack, fixado em `package.json`;
- Docker com Compose;
- Git;
- editor conectado ao ambiente Linux quando estiver no Windows.

## Regras locais

- Não versione `.env` ou credenciais.
- Mantenha `.env.example` atualizado com nomes e descrições seguras.
- Prefira armazenar o repositório no filesystem do WSL se file watching ou I/O em volume montado ficar lento.
- Serviços locais usam nomes e portas documentados no Compose.

## PostgreSQL local

O serviço `postgres` usa PostgreSQL 18.6, persiste dados no volume nomeado `sistema-erp_postgres-data` e publica a porta somente em `127.0.0.1`. O health check usa `pg_isready` e o servidor opera em UTC.

Copie `.env.example` para `.env` antes de iniciar a infraestrutura. Os valores do exemplo são exclusivos para desenvolvimento local e não devem ser reutilizados em ambientes compartilhados.

| Variável              | Finalidade                         | Valor local padrão         |
| --------------------- | ---------------------------------- | -------------------------- |
| `POSTGRES_HOST`       | Host usado pelas aplicações locais | `localhost`                |
| `POSTGRES_PORT`       | Porta publicada pelo Compose       | `5432`                     |
| `POSTGRES_DB`         | Banco de desenvolvimento           | `sistema_erp`              |
| `POSTGRES_USER`       | Usuário de desenvolvimento         | `sistema_erp`              |
| `POSTGRES_PASSWORD`   | Senha exclusivamente local         | `local_development_only`   |
| `DATABASE_URL`        | Conexão do Prisma e readiness      | derivada dos valores acima |
| `API_HOST`            | Interface de escuta da API         | `0.0.0.0`                  |
| `API_PORT`            | Porta HTTP da API                  | `3000`                     |
| `VITE_API_BASE_URL`   | URL pública da API no bundle web   | vazio (mesma origem)       |
| `SEED_ADMIN_PASSWORD` | Senha do administrador sintético   | `local_admin_only`         |

## Armazenamento de objetos local

O serviço `minio` fornece uma instância S3 compatível exclusivamente para desenvolvimento e testes.
Ele persiste objetos no volume nomeado `sistema-erp_minio-data`, publica API e console somente em
`127.0.0.1` e não representa a topologia, durabilidade ou política de backup de produção.

Ao subir a infraestrutura, o serviço one-shot `minio-init` cria de forma idempotente o bucket
privado e habilita seu versionamento. A credencial root existe somente para essa administração
local; a aplicação não deve reutilizá-la como credencial de runtime.

| Variável              | Finalidade                                | Valor local padrão       |
| --------------------- | ----------------------------------------- | ------------------------ |
| `MINIO_ROOT_USER`     | Usuário administrativo local              | `sistema_erp_admin`      |
| `MINIO_ROOT_PASSWORD` | Senha administrativa exclusivamente local | `local_minio_admin_only` |
| `MINIO_BUCKET`        | Bucket privado usado nos testes           | `sistema-erp-private`    |
| `MINIO_API_PORT`      | Porta S3 publicada em loopback            | `9000`                   |
| `MINIO_CONSOLE_PORT`  | Porta do console publicada em loopback    | `9001`                   |

A API S3 fica em `http://localhost:9000` e o console em `http://localhost:9001`. As imagens do
servidor e do cliente MinIO estão fixadas no Compose. O repositório oficial do servidor foi
arquivado em 2026; por isso essas imagens servem apenas ao ambiente local isolado e sua substituição
deve ser avaliada antes de qualquer uso compartilhado ou de produção.

Com o MinIO e seu inicializador ativos, `pnpm test:s3:integration` valida o contrato `put/head/get`
do adapter. Esse teste usa a credencial root local somente como fixture administrativa; ela não é
configuração de runtime da API. A variável opcional `S3_TEST_ENDPOINT` permite apontar o teste para
outra porta local.

## Comandos esperados

Estes scripts deverão ser implementados na raiz:

```bash
pnpm install
pnpm dev
pnpm build
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm test:e2e:docker
pnpm db:generate
pnpm db:migrate
pnpm db:migrate:deploy
pnpm db:migrate:status
pnpm db:seed
pnpm contracts:generate
pnpm infra:up
pnpm infra:down
pnpm infra:status
pnpm infra:logs
pnpm verify
```

## Primeiro bootstrap planejado

1. Instalar a versão fixada do Node e habilitar Corepack.
2. Executar `pnpm install`.
3. Copiar `.env.example` para `.env` e preencher apenas valores locais.
4. Executar `pnpm infra:up`.
5. Executar `pnpm db:migrate` e `pnpm db:seed`.
6. Executar `pnpm dev`.
7. Confirmar health check da API e página de diagnóstico da web.
8. Executar `pnpm verify` antes de enviar alterações.

Os comandos de workspace, infraestrutura e banco listados acima estão disponíveis. `db:migrate` cria migrations apenas em desenvolvimento; ambientes compartilhados usam exclusivamente `db:migrate:deploy`.

Com o PostgreSQL saudável, `pnpm dev` inicia a API em `http://localhost:3000` e a aplicação web em `http://localhost:5173`. O endpoint de processo está em `/api/v1/health`, a prontidão com PostgreSQL em `/api/v1/health/ready`, a interface Swagger em `/docs`, o contrato em `/openapi.json` e a página web de diagnóstico em `/diagnostics`.

`pnpm contracts:generate` exporta o OpenAPI diretamente da aplicação NestJS e regenera o SDK TypeScript consumido pela web. Os arquivos em `packages/contracts/src/generated` são artefatos e nunca devem ser editados manualmente.

Antes do primeiro E2E local, instale o Chromium gerenciado pelo Playwright com
`pnpm test:e2e:install`. O comando `pnpm test:e2e` inicia API e web, reutiliza processos locais
quando disponíveis e valida o fluxo de diagnóstico contra o PostgreSQL. A infraestrutura e as
migrations devem estar prontas.

Em WSL sem as bibliotecas gráficas do Chromium, use preferencialmente `pnpm test:e2e:docker`. O
comando executa API, Vite e Playwright na imagem oficial fixada na mesma versão do projeto, conecta
ao serviço `postgres` pela rede privada do Compose e não publica novas portas. A imagem E2E instala
dependências em uma camada isolada e reaproveitável; XMLs locais, `.env`, `node_modules`, builds e
relatórios não entram no contexto nem são escritos pelo contêiner no workspace.

Para mudanças que contêm código ou configuração executável, o workflow de CI aplica migrations em
um PostgreSQL efêmero e executa formatação, lint, typecheck, testes, build, checagem do contrato
gerado e E2E. PRs compostos somente por Markdown executam apenas uma validação leve do diff, sem
instalar dependências ou iniciar PostgreSQL. A política de manutenção está em
[Atualização de dependências](dependency-updates.md).

O seed cria de forma idempotente a organização `demo`, o usuário sintético
`admin@example.test` e sua membership `OWNER`. A senha vem de `SEED_ADMIN_PASSWORD` e é exclusiva
do ambiente local. Para abrir uma sessão, envie `email`, `password` e `organizationSlug` para
`POST /api/v1/auth/sessions`; use o token opaco como `Authorization: Bearer <token>`.

Rotas autenticadas derivam usuário, papel e organização da sessão persistida. O endpoint
`GET /api/v1/organizations/current` expõe o tenant atual, memberships administrativas ficam em
`/api/v1/organizations/current/memberships` e eventos auditáveis em `/api/v1/audit/events`.
Criações reexecutáveis exigem `Idempotency-Key` e rejeitam a reutilização da chave com outro
payload.
