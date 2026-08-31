# ADR-0006 — Primitivas de segurança e tenant

- Status: Aceita
- Data: 2026-08-31

## Contexto

A primeira funcionalidade do ERP depende de identidade, tenant, autorização, auditoria e
idempotência com comportamento uniforme. Adiar essas garantias permitiria que módulos funcionais
criassem fontes concorrentes de autorização ou consultas sem isolamento.

## Decisão

- Usuários são globais e usam e-mail normalizado como identificador de login.
- O acesso a uma organização ocorre exclusivamente por uma membership ativa.
- A sessão é opaca, armazena somente o hash SHA-256 do token e fixa uma membership durante sua
  validade.
- O slug informado no login seleciona a membership; depois da autenticação, `organizationId` vem
  somente da sessão validada.
- Os papéis iniciais são `OWNER`, `ADMIN` e `MEMBER`. Endpoints declaram os papéis autorizados.
- Eventos relevantes são gravados de forma estruturada e a tabela de auditoria rejeita alterações e
  exclusões no PostgreSQL.
- Chaves de idempotência são isoladas por organização e operação. Reutilizar uma chave com payload
  diferente resulta em conflito.
- Senhas usam scrypt com salt individual. O seed contém apenas identidade e credencial sintéticas de
  desenvolvimento.

## Consequências

Uma troca de organização exige nova sessão, evitando contexto de tenant mutável. Tokens não podem
ser recuperados do banco. A autenticação inicial é adequada ao monólito, mas recuperação de senha,
MFA, convite e rotação de sessão permanecem trabalhos futuros antes de exposição pública.
