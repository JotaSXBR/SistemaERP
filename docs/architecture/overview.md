# Visão arquitetural

## Objetivo

Construir um ERP web confiável, multiempresa e preparado para automações assistidas por IA, mantendo a operação viável para uma equipe de uma pessoa.

## Princípios

1. **Monólito modular primeiro.** Separação lógica forte, implantação simples.
2. **PostgreSQL é a fonte de verdade.** Filas, vetores e caches são auxiliares.
3. **Contratos explícitos.** A API publica OpenAPI; consumidores usam clientes gerados.
4. **Tenant e auditoria por padrão.** Não são detalhes adicionados depois.
5. **Automação verificável.** Toda tarefa recorrente deve poder ser executada por CI ou `pnpm verify`.
6. **IA sob controle determinístico.** Modelos propõem; código autorizado valida e executa.
7. **Complexidade progressiva.** Uma tecnologia entra quando resolve uma necessidade observada.

## Contexto de execução

```text
Navegador
   |
   v
React/Vite ---- cliente gerado de OpenAPI
   |
   v
NestJS/Fastify (monólito modular)
   |
   +---- PostgreSQL/Prisma
   +---- Worker/BullMQ     [futuro]
   +---- S3/MinIO          [futuro]
   +---- Provedor de LLM   [futuro]
```

## Limites do monorepo

```text
apps/
  api/          API HTTP e composição dos módulos
  web/          aplicação React

packages/
  database/     schema, migrations e cliente Prisma
  contracts/    cliente OpenAPI gerado e tipos públicos
  configuration/ configuração compartilhada estritamente necessária
  observability/ abstrações de logs, métricas e tracing
  testing/      factories e utilitários de teste
  ui/           componentes reutilizados de interface
```

Pacotes só devem existir quando houver um consumidor real ou uma fronteira técnica clara. Módulos de negócio permanecem inicialmente dentro de `apps/api`.

## Módulos fundamentais

- `health`: saúde e prontidão da aplicação;
- `identity`: usuários, autenticação e sessões;
- `organizations`: empresas, memberships e contexto do tenant;
- `authorization`: papéis e permissões;
- `audit`: registro imutável de ações relevantes.

Módulos funcionais do ERP serão definidos depois que essas primitivas estiverem estáveis.

## Requisitos transversais

Toda requisição autenticada deve possuir `requestId`, `correlationId`, `userId` e `organizationId`. Erros, logs, auditoria e traces devem poder ser correlacionados por esses identificadores.

Operações financeiras, fiscais, integrações, webhooks e ações iniciadas por IA devem suportar idempotência quando houver risco de reexecução.
