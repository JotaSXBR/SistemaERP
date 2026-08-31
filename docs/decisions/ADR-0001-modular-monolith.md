# ADR-0001 — Monólito modular em monorepo

- Status: Aceita
- Data: 2026-08-28

## Contexto

Uma pessoa desenvolverá e operará o sistema com apoio de IA. Distribuição precoce aumenta coordenação, deploys e diagnóstico.

## Decisão

Usar monorepo TypeScript e um monólito modular para a API. Módulos têm fronteiras explícitas e não acessam internals uns dos outros.

## Consequências

Implantação, testes e transações permanecem simples. Extração para serviço separado só ocorrerá com evidência de necessidade de escala, segurança, disponibilidade ou autonomia operacional e exigirá novo ADR.
