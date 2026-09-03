# Contribuindo

Obrigado por contribuir com o Sistema ERP. Antes de começar, leia:

- [instruções para agentes e definition of done](AGENTS.md);
- [convenções por área](docs/conventions/);
- [preparação do ambiente](docs/development/setup.md);
- [decisões arquiteturais](docs/decisions/).

## Fluxo resumido

1. Relacione a mudança a uma issue quando ela representar uma entrega testável.
2. Crie uma branch curta: `feat/<slug>`, `fix/<slug>`, `docs/<slug>` ou `chore/<slug>`.
3. Faça commits no padrão Conventional Commits descrito em [AGENTS.md](AGENTS.md).
4. Execute a validação proporcional ao risco e registre no PR o que não pôde ser validado.
5. Abra um PR pequeno contra `main`, com escopo e critério de pronto claros.

Separe em branches/PRs próprios mudanças de schema ou migration, autenticação ou tenant, parser
fiscal e upload. Esses temas exigem revisão de risco e `pnpm verify`.

O CI é a fonte de verdade. Os hooks instalados por `pnpm install` apenas antecipam formatação e
lint dos arquivos staged; não substituem a suíte pertinente nem a revisão humana.

Não inclua segredos, `.env`, XML real, `files/`, `.local-data/`, dados pessoais reais ou artefatos
gerados editados manualmente. Consulte o [processo de segurança](.github/SECURITY.md) para relatar
vulnerabilidades sem exposição pública.
