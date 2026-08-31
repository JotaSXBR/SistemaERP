# Instruções para agentes de IA

## Missão

Implementar o ERP respeitando a documentação em `docs/`. Não invente arquitetura local que contradiga uma decisão registrada.

## Antes de alterar código

1. Leia `docs/architecture/overview.md` e o documento de convenções da camada afetada.
2. Verifique decisões em `docs/decisions/`.
3. Inspecione o código existente antes de propor novos padrões.
4. Declare qualquer suposição que afete domínio, segurança, tenant, dinheiro ou auditoria.

## Regras obrigatórias

- Preserve o monólito modular; não crie microsserviços sem ADR aprovado.
- Não adicione dependências sem justificar necessidade, manutenção e alternativa nativa.
- Toda entidade de negócio multiempresa deve ser vinculada a `organizationId`.
- Nunca aceite `organizationId` do corpo como fonte de autorização; derive-o do contexto autenticado.
- Dinheiro usa decimal no código e `numeric` no PostgreSQL; nunca `float`.
- Instantes são persistidos em UTC; datas civis usam o tipo de data apropriado.
- Mudanças relevantes devem produzir auditoria estruturada.
- Operações reexecutáveis ou externas devem ser idempotentes.
- Não edite manualmente clientes, schemas ou artefatos gerados.
- Migrations são imutáveis depois de aplicadas em ambiente compartilhado.
- IA nunca grava dados críticos sem validação determinística, autorização e auditoria.

## Critério de conclusão

Uma mudança só está concluída quando:

- compila com TypeScript strict;
- passa em formatação, lint, typecheck e testes pertinentes;
- inclui migrations e testes quando necessários;
- atualiza OpenAPI e cliente gerado quando o contrato muda;
- atualiza documentação ou ADR quando introduz uma decisão;
- não contém segredos, dados pessoais reais ou logs sensíveis;
- informa claramente o que foi validado e o que não pôde ser validado.

Quando disponível, execute `pnpm verify` antes de concluir.
