# Convenções para recursos de IA

## Fronteira

O módulo de IA não acessa diretamente tabelas de negócio nem executa ações arbitrárias. Ele usa ferramentas tipadas que aplicam autorização, tenant, validação, idempotência e auditoria.

## Classificação de risco

- Leitura: pode responder com dados que o usuário já pode consultar.
- Proposta: gera rascunho ou sugestão sem persistir efeito crítico.
- Escrita reversível: requer confirmação clara e auditoria.
- Escrita crítica: requer validação determinística e aprovação humana explícita.
- Proibida: ação fora das permissões, evasão de controles ou exposição de segredo.

## Requisitos por chamada

Registrar, com política de retenção adequada:

- caso de uso;
- provedor e modelo;
- versão do prompt;
- duração, tokens e custo estimado;
- ferramentas chamadas e resultados resumidos;
- usuário, organização, request e trace;
- aprovação e resultado final.

Não registrar prompts completos quando contiverem dados pessoais ou segredos. Redação e minimização devem ocorrer antes da telemetria.

## Adoção progressiva

1. SDK encapsulado e saída estruturada.
2. Langfuse quando houver chamadas reais que precisem de avaliação.
3. pgvector quando existir corpus, política de acesso e métrica de recuperação.
4. LangGraph quando houver estado persistente, ramificações, retries complexos ou human-in-the-loop.

Modelos e prompts nunca são fonte de verdade para cálculos financeiros, tributários ou decisões de autorização.

