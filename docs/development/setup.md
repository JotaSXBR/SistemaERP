# Ambiente de desenvolvimento

## Ambiente-alvo

- Windows com WSL2 e Ubuntu, ou Linux/macOS equivalente;
- Node.js Active LTS fixado pelo repositório;
- pnpm via Corepack;
- Docker com Compose;
- Git;
- editor conectado ao ambiente Linux quando estiver no Windows.

## Regras locais

- Não versione `.env` ou credenciais.
- Mantenha `.env.example` atualizado com nomes e descrições seguras.
- Prefira armazenar o repositório no filesystem do WSL se file watching ou I/O em volume montado ficar lento.
- Serviços locais usam nomes e portas documentados no Compose.

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
pnpm db:seed
pnpm infra:up
pnpm infra:down
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

Até o scaffold ser implementado, esses comandos são contratos planejados, não garantias de disponibilidade.

