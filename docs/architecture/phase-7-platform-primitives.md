# Fase 7 — Primitivas de plataforma

- **Estado:** concluída
- **Data:** 2026-08-31
- **Tipo:** fundação técnica
- **Decisão relacionada:** [ADR-0006 — Primitivas de segurança e tenant](../decisions/ADR-0006-platform-security-primitives.md)

## Objetivo

Estabelecer as garantias comuns de identidade, sessão, organização, autorização, auditoria,
idempotência e isolamento de tenant antes do início dos módulos funcionais do ERP.

## Entregas realizadas

### Identidade e sessões

- Usuários globais com e-mail normalizado e credencial armazenada como hash scrypt com salt
  individual.
- Login por e-mail, senha e slug da organização.
- Sessões opacas com token aleatório; somente o hash SHA-256 do token é persistido.
- Sessão vinculada a uma membership específica e com validade de oito horas.
- Validação de expiração, revogação e status da membership em toda requisição autenticada.
- Atualização de `lastUsedAt` ao validar uma sessão.
- Limitação de tentativas de login e resposta uniforme para credenciais inválidas.

Endpoints disponíveis:

- `POST /api/v1/auth/sessions` — cria uma sessão;
- `GET /api/v1/auth/session` — retorna a identidade da sessão atual;
- `POST /api/v1/auth/sessions/current/revoke` — revoga a sessão atual.

### Organizações e memberships

- Organização com `slug` único.
- Membership única por combinação de organização e usuário.
- Estados `ACTIVE` e `SUSPENDED`.
- Papéis iniciais `OWNER`, `ADMIN` e `MEMBER`.
- A organização atual é obtida exclusivamente da sessão autenticada.
- Criação de memberships restrita a `OWNER` e `ADMIN`, com atribuição de `ADMIN` restrita ao
  `OWNER`.
- Payloads que tentem informar `organizationId` são rejeitados; esse valor não é uma fonte de
  autorização.

Endpoints disponíveis:

- `GET /api/v1/organizations/current`;
- `GET /api/v1/organizations/current/memberships` — `OWNER` ou `ADMIN`;
- `POST /api/v1/organizations/current/memberships` — `OWNER` ou `ADMIN`, com
  `Idempotency-Key` obrigatório.

### Autorização e contexto da requisição

- Guard global de autenticação com opt-out explícito apenas para rotas públicas.
- Decorador `Roles` e guard de papéis para autorização declarativa nos endpoints.
- Contexto autenticado contendo `requestId`, `correlationId`, `userId`, `organizationId`,
  `membershipId` e papel.
- Consultas de organização e auditoria filtradas pelo `organizationId` derivado do contexto.

### Auditoria

- Eventos estruturados com ação, entidade, ator, organização, `requestId`, `correlationId`,
  metadados e instante UTC.
- Criação e revogação de sessão e criação de membership geram eventos auditáveis.
- Eventos são consultáveis por `OWNER` e `ADMIN` em `GET /api/v1/audit/events`, limitados aos 100
  mais recentes do tenant atual.
- Constraints e triggers PostgreSQL impedem alteração e exclusão de eventos de auditoria.

### Idempotência

- Chaves isoladas por organização e operação.
- Validação de formato da chave e retenção de registros por 24 horas.
- Reexecução com a mesma chave e o mesmo payload retorna a resposta salva.
- Reutilização da chave com payload diferente resulta em conflito.
- Criação de membership executa a gravação do resultado e do registro de idempotência na mesma
  transação.

## Persistência e migrations

O schema Prisma inclui `User`, `Organization`, `Membership`, `Session`, `AuditEvent` e
`IdempotencyRecord`, com chaves estrangeiras, unicidade por tenant e índices para as consultas
autenticadas.

Migrations relacionadas:

- `20260831175349_platform_primitives`;
- `20260831180403_session_membership_integrity`;
- `20260831181000_enforce_audit_immutability`.

## Validação

O comportamento da fase possui cobertura em
`apps/api/tests/platform.integration.test.ts`, incluindo:

- autenticação e rejeição de sessão inválida;
- autorização por papel;
- isolamento entre organizações;
- criação e replay idempotente de membership;
- conflito para payload alterado;
- registro de auditoria.

## Fora do escopo desta fase

Recuperação de senha, MFA, convites, rotação de sessão, permissões customizadas e exposição
pública da API permanecem como trabalhos futuros.

A Fase 7 também não implementa integração direta com o SIEG. Na Fase 8, o XML fiscal pode ser
baixado do SIEG e importado manualmente; a integração automática fica para uma etapa posterior.
