# Convenções de backend

## Organização de módulo

```text
modules/<nome>/
  application/    casos de uso e portas
  domain/         regras e tipos de domínio
  infrastructure/integrações e persistência
  presentation/   controllers e DTOs HTTP
  <nome>.module.ts
```

Use essa separação quando o módulo justificar. Módulos pequenos podem começar mais simples, sem criar arquivos vazios.

## Dependências

- Controllers traduzem HTTP e chamam casos de uso; não contêm regra de negócio.
- Casos de uso não dependem de objetos HTTP.
- Módulos comunicam-se por APIs públicas, não por imports profundos.
- Acesso ao Prisma é centralizado em providers/repositórios; controllers não consultam o banco.

## Validação e erros

- Valide toda entrada na fronteira.
- Use códigos de erro estáveis e mensagens localizáveis.
- Não exponha stack trace, SQL ou detalhes internos ao cliente.
- Erros inesperados recebem `requestId` e são registrados de forma estruturada.

Formato público:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Recurso não encontrado",
    "details": {},
    "requestId": "req_123"
  }
}
```

## API

- Prefixo `/api/v1`.
- Recursos no plural e nomes em inglês no código e nas rotas.
- Paginação explícita, com limites máximos.
- Endpoints mutáveis documentam efeitos e idempotência.
- OpenAPI deve representar respostas de sucesso e erros relevantes.

## Segurança

- Autenticação identifica o usuário; autorização valida ação e recurso.
- Tenant vem do contexto autenticado.
- Segredos nunca aparecem em logs.
- Rate limiting deve ser aplicado a autenticação, recuperação e endpoints caros.

