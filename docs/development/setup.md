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

| Variável            | Finalidade                         | Valor local padrão         |
| ------------------- | ---------------------------------- | -------------------------- |
| `POSTGRES_HOST`     | Host usado pelas aplicações locais | `localhost`                |
| `POSTGRES_PORT`     | Porta publicada pelo Compose       | `5432`                     |
| `POSTGRES_DB`       | Banco de desenvolvimento           | `sistema_erp`              |
| `POSTGRES_USER`     | Usuário de desenvolvimento         | `sistema_erp`              |
| `POSTGRES_PASSWORD` | Senha exclusivamente local         | `local_development_only`   |
| `DATABASE_URL`      | Conexão do Prisma e readiness      | derivada dos valores acima |
| `API_HOST`          | Interface de escuta da API         | `0.0.0.0`                  |
| `API_PORT`          | Porta HTTP da API                  | `3000`                     |
| `VITE_API_BASE_URL` | URL pública da API no bundle web   | vazio (mesma origem)       |

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

O workflow de CI aplica migrations em um PostgreSQL efêmero e executa formatação, lint, typecheck,
testes, build, checagem do contrato gerado e E2E. A política de manutenção está em
[Atualização de dependências](dependency-updates.md).

O baseline inicial não cria tabelas de domínio. Isso é intencional: organizações, identidade, autorização e auditoria serão modeladas na Fase 7, quando seus requisitos e isolamento de tenant puderem ser implementados e testados em conjunto. O seed atual apenas valida a conexão, não grava registros e pode ser executado repetidamente.
