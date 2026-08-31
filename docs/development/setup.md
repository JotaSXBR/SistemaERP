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
| `DATABASE_URL`      | Conexão futura do Prisma           | derivada dos valores acima |

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

O baseline inicial não cria tabelas de domínio. Isso é intencional: organizações, identidade, autorização e auditoria serão modeladas na Fase 7, quando seus requisitos e isolamento de tenant puderem ser implementados e testados em conjunto. O seed atual apenas valida a conexão, não grava registros e pode ser executado repetidamente.
