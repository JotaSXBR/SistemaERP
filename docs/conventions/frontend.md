# Convenções de frontend

## Organização

```text
src/
  app/        bootstrap, providers e rotas
  features/   fluxos orientados ao usuário
  pages/      composição de páginas
  shared/     componentes e utilitários genéricos
```

- Estado remoto pertence ao TanStack Query.
- Estado local permanece próximo do componente.
- Não copie respostas da API para um store global sem motivo verificável.
- Acesso HTTP ocorre pelo cliente gerado, nunca por URLs espalhadas.

## Componentes

- Componentes de UI não conhecem regras de negócio.
- Componentes de feature podem orquestrar formulários e mutations.
- Acessibilidade por teclado e labels são obrigatórios.
- Estados de carregamento, vazio, erro e permissão negada são parte do componente.

## Formulários

- React Hook Form para estado de formulário.
- Zod para validação do cliente.
- A API continua sendo autoridade de validação.
- Valores monetários não são convertidos em ponto flutuante para cálculo.

## Design system

Tailwind define tokens e composição visual. Componentes base acessíveis podem usar Radix UI/shadcn. Evite classes arbitrárias repetidas; promova padrões recorrentes para tokens ou componentes.
