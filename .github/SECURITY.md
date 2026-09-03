# Política de segurança

## Versões suportadas

O projeto está em desenvolvimento inicial. Somente a versão vigente na branch `main` recebe
correções de segurança.

## Como relatar uma vulnerabilidade

Não abra issue, discussão ou PR público com detalhes exploráveis, credenciais, dados pessoais ou
amostras reais.

Use **Security → Report a vulnerability** neste repositório para enviar um relato privado. Inclua,
quando possível:

- componente e versão ou commit afetado;
- impacto e pré-condições;
- passos mínimos de reprodução com dados sintéticos;
- mitigação sugerida;
- forma segura de contato para acompanhamento.

Se o botão de relato privado não estiver disponível, avise o mantenedor indicado em `CODEOWNERS`
sem revelar detalhes e solicite um canal privado.

O mantenedor deve confirmar o recebimento, avaliar severidade e coordenar correção e divulgação.
Não há SLA público nesta fase; vulnerabilidades com exploração ativa ou exposição de dados recebem
prioridade máxima.

O CI executa Gitleaks em pull requests e pushes para `main`. CodeQL para JavaScript/TypeScript deve
ser adicionado depois que GitHub Code Security estiver disponível e habilitado para este repositório
privado; antecipar o job faria a proteção depender de uma capacidade externa ainda não confirmada.

Segredos encontrados no histórico devem ser revogados e rotacionados antes da limpeza do Git. Não
publique o valor comprometido em logs, comentários ou relatórios.
