# ADR-0005 — Infraestrutura progressiva de IA

- Status: Aceita
- Data: 2026-08-28

## Decisão

Recursos de IA começam como um módulo isolado da API, atrás de interfaces próprias. O SDK do provedor será encapsulado. pgvector, Langfuse e LangGraph entram somente quando seus respectivos casos existirem.

## Controles obrigatórios

- entradas e saídas estruturadas e validadas;
- timeout, retry limitado e orçamento de custo;
- prompts e versão do modelo rastreáveis;
- dados sensíveis minimizados;
- autorização igual ou mais restrita que a do usuário solicitante;
- aprovação humana para ações críticas;
- auditoria de proposta, aprovação e execução.
