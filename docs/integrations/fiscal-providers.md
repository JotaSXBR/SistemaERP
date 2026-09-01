# Provedores e integração fiscal

- Estado: Recomendação provisória para prova técnica e comercial de emissão
- Pesquisa atualizada em: 2026-08-31
- Aplicação prevista: emissão na Fase 10

## Decisão provisória

| Papel             | Escolha              | Motivo principal                                                                                                         |
| ----------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Emissor principal | Focus NFe            | Documentação pública clara, NF-e/NFC-e, homologação, webhooks, referência única, recebimento e adequação publicada à RTC |
| Primeiro backup   | Nuvem Fiscal         | API REST abrangente, OAuth2 com escopos, Distribuição NF-e, eventos e recursos de diagnóstico                            |
| Segundo backup    | PlugNotas/TecnoSpeed | API REST madura, NF-e/NFC-e, fluxo assíncrono com webhook e atualização documentada para a RTC                           |

Essa escolha não autoriza contratação nem integração de produção. O emissor principal só será
confirmado depois de prova técnica, proposta comercial, avaliação contratual e validação da
contabilidade.

## Comparação dos emissores

### 1. Focus NFe — principal recomendado

Pontos favoráveis observáveis na documentação:

- NF-e, NFC-e e documentos recebidos na mesma API;
- ambientes separados de homologação e produção;
- referência externa única por emissão, útil para idempotência e reconciliação;
- NF-e assíncrona e NFC-e síncrona, com consulta de estado;
- webhooks com tentativas documentadas em caso de falha;
- download e backup de XMLs;
- contingência offline de NFC-e documentada;
- guia e campos publicados para IBS/CBS da Reforma Tributária.

Pontos para a prova:

- autenticação HTTP Basic baseada em token exige armazenamento e rotação cuidadosos;
- confirmar assinatura/autenticidade de webhook e usar segredo próprio mais reconciliação se não
  houver assinatura nativa suficiente;
- validar todos os eventos exigidos, certificado, suporte e tempo de resposta real;
- confirmar preço, cota, retenção, SLA e cláusula de exportação.

Fontes:

- [Introdução da API Focus NFe](https://doc.focusnfe.com.br/reference/introducao)
- [Ambientes](https://doc.focusnfe.com.br/reference/ambiente)
- [Emissão de NF-e](https://doc.focusnfe.com.br/reference/emitir_nfe)
- [Emissão de NFC-e](https://doc.focusnfe.com.br/reference/emitir_nfce)
- [Webhooks e retentativas](https://doc.focusnfe.com.br/reference/webhooks)
- [Reforma Tributária](https://focusnfe.com.br/guides/reforma-tributaria/)

### 2. Nuvem Fiscal — primeiro backup

Pontos favoráveis observáveis na documentação:

- NF-e, NFC-e, Distribuição NF-e e eventos em uma API REST;
- OAuth2 `client_credentials` e scopes por serviço;
- configuração explícita de homologação ou produção por empresa;
- referência externa opcional para ajudar a evitar duplicidade;
- download de XMLs, cancelamento, carta de correção, inutilização e consulta à SEFAZ;
- endpoint de prévia e recurso de debug da comunicação fiscal.

Pontos para a prova:

- confirmar semântica forte de idempotência, webhooks e política de retentativa;
- testar contingência de NFC-e e comportamento durante indisponibilidade;
- validar ergonomia do payload, atualização RTC, suporte, SLA e exportação;
- confirmar preço e cotas de documentos e eventos.

Fontes:

- [Introdução da Nuvem Fiscal](https://dev.nuvemfiscal.com.br/docs/)
- [Autenticação OAuth2](https://dev.nuvemfiscal.com.br/docs/autenticacao/)
- [Recursos de NF-e](https://dev.nuvemfiscal.com.br/docs/nfe/)
- [Referência da API](https://dev.nuvemfiscal.com.br/docs/api/)

### 3. PlugNotas/TecnoSpeed — segundo backup

Pontos favoráveis observáveis na documentação:

- API REST com NF-e e NFC-e;
- emissão assíncrona, consulta e webhook;
- geração e download de XML/PDF;
- homologação oficial configurável por empresa;
- campos da Reforma Tributária e calculadora oficial de IBS/CBS documentados.

Pontos para a prova:

- o sandbox inicial usa retornos simulados e não testa o webhook completo;
- o teste fiscal real de homologação ocorre na API oficial e precisa fazer parte do contrato de
  avaliação;
- confirmar idempotência, autenticação de webhook, contingência, SLA, suporte e exportação;
- comparar a amplitude do produto com a complexidade e o custo necessários para uma única empresa.

Fontes:

- [Primeiros passos do PlugNotas](https://atendimento.tecnospeed.com.br/hc/pt-br/articles/23715383551767-Primeiros-Passos-com-o-Plugnotas)
- [Fluxo de emissão e webhook](https://atendimento.tecnospeed.com.br/hc/pt-br/articles/1500004889622-Entendendo-o-Fluxo-de-emiss%C3%A3o)
- [Sandbox e API oficial](https://atendimento.tecnospeed.com.br/hc/pt-br/articles/360055363553-Entendendo-os-envios-para-o-PlugNotas)
- [Adequações NF-e/NFC-e à Reforma Tributária](https://atendimento.tecnospeed.com.br/hc/pt-br/articles/34079133324183-O-que-mudou-nos-arquivos-de-integra%C3%A7%C3%A3o-com-a-Reforma-Tribut%C3%A1ria-NF-e-NFC-e-CT-e-CTe-OS-NFCom)

## Arquitetura independente do provedor

O módulo fiscal expõe uma porta interna, por exemplo:

```text
FiscalDocumentService
        |
        v
FiscalProviderPort
        |
        +--> FocusAdapter
        +--> NuvemFiscalAdapter      [somente após prova/necessidade]
        +--> PlugNotasAdapter        [somente após prova/necessidade]
```

A porta usa comandos e resultados canônicos do ERP. Payloads, códigos de erro, tokens e estados
específicos ficam dentro do adaptador. O banco preserva:

- provedor e ambiente usados;
- identificador interno e referência externa;
- hash do comando canônico e versão do mapeamento;
- estado interno e estado bruto do provedor;
- XML, protocolo, chave e eventos autorizados;
- histórico de tentativas, webhooks e reconciliações.

Não será criada uma abstração que esconda diferenças fiscais relevantes. Campos que não têm
semântica comum permanecem em extensão versionada do adaptador, enquanto o snapshot fiscal
autorizado continua acessível ao domínio.

## Regra de backup e troca

Backup de emissor não é balanceamento de carga nem repetição automática em outro fornecedor.

- Uma emissão iniciada fica vinculada ao provedor até reconciliação de seu resultado.
- Timeout não significa falha; primeiro consulta-se o provedor e a SEFAZ para evitar duplicidade.
- Uma nota autorizada, rejeitada com numeração consumida ou em contingência não é reenviada cegamente
  ao backup.
- Troca de provedor vale por padrão somente para novas emissões ainda não iniciadas.
- Série, numeração, certificado, CSC, credenciamento e contingência precisam ser previamente
  configurados e homologados no backup.
- Eventos posteriores continuam roteados ao provedor de origem, salvo procedimento fiscal aprovado
  e testado.

Na primeira entrega da Fase 10 será implementado apenas o adaptador principal. Os contratos e testes
de conformidade comuns devem permitir construir os backups sem alterar vendas ou estoque. Manter
três integrações ativas desde o início aumentaria custo e risco sem comprovar disponibilidade.

## Prova técnica obrigatória antes da contratação

Executar o mesmo conjunto de cenários nos três candidatos:

1. autorização e rejeição de NF-e em homologação;
2. consulta após timeout sem duplicar emissão;
3. cancelamento, carta de correção e inutilização;
4. download de XML, protocolo e DANFE;
5. webhook duplicado, fora de ordem e temporariamente indisponível;
6. campos IBS/CBS e CNPJ alfanumérico;
7. NFC-e e contingência, mesmo que o recurso não seja ativado imediatamente;
8. rotação de certificado e credenciais;
9. exportação completa e reconciliação por período;
10. atendimento de incidente e evidência de SLA.

## Avaliação comercial e de risco

A decisão final deve registrar:

- preço fixo, preço por documento/evento e excedentes no volume real;
- prazo e reajuste contratual;
- SLA mensurável e créditos por indisponibilidade;
- suboperadores, localização, retenção e descarte de dados;
- responsabilidade sobre certificado digital e resposta a incidente;
- política de versionamento e antecedência para mudanças incompatíveis;
- suporte técnico disponível durante implantação e operação;
- exportação integral sem aprisionamento ao encerrar o contrato.

Preços não foram congelados neste documento porque mudam e dependem de proposta. A recomendação é
técnica e provisória, não uma afirmação de superioridade comercial ou disponibilidade real.
