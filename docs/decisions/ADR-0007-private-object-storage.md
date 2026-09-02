# ADR-0007 — Armazenamento privado de documentos

- Status: Aceita
- Data: 2026-09-02

## Contexto

A caixa de entrada fiscal precisa preservar XMLs de NF-e e, posteriormente, certificados de
qualidade. Esses arquivos podem conter dados pessoais, fiscais e comerciais e não pertencem ao
PostgreSQL, que continuará armazenando metadados, estados e vínculos transacionais.

A aplicação será mantida por uma equipe de uma pessoa. Operar armazenamento distribuído em
produção sem necessidade comprovada aumentaria o risco de perda, indisponibilidade e restauração
não testada. Ao mesmo tempo, desenvolvimento e testes não devem depender de uma conta externa.

Não há restrição de provedor de nuvem ou residência de dados registrada até esta decisão. Se ela
surgir, a implantação deve parar e esta ADR deve ser substituída antes de armazenar documentos
reais.

## Decisão

### Backend e fronteira

- A aplicação usa uma porta interna de armazenamento de objetos baseada no subconjunto necessário
  da API S3: gravar, consultar metadados e ler um objeto.
- Amazon S3 gerenciado é o backend padrão de produção. Região, conta, política de retenção e plano
  de recuperação são configuração operacional e devem ser aprovados antes do primeiro documento
  real.
- MinIO é o backend local de desenvolvimento e dos testes de integração. Uma instância local de nó
  único não representa durabilidade, backup ou topologia de produção.
- Um backend alternativo compatível com S3 exige testes de contrato para as operações e garantias
  usadas pelo ERP. Diferenças de semântica não podem vazar para os casos de uso.
- Quando a implementação começar, o adapter usará o cliente modular S3 do AWS SDK for JavaScript
  v3. A dependência ficará no módulo proprietário, não em um pacote genérico antecipado.

### Provisionamento e acesso

- Buckets, criptografia, versionamento, políticas e credenciais são provisionados fora da
  aplicação. O runtime do ERP não recebe permissão para administrar buckets ou políticas.
- O bucket é privado, com bloqueio de acesso público. A credencial da aplicação segue privilégio
  mínimo e não é compartilhada com tarefas administrativas, backup ou replicação.
- Tráfego de produção usa TLS. Objetos usam criptografia server-side; SSE-S3 é o mínimo e SSE-KMS
  deve ser adotado quando houver requisito de chave gerenciada ou segregação adicional.
- Segredos não entram no Git, em imagens, logs, metadados de objetos ou respostas HTTP. Em produção,
  prefira credenciais temporárias fornecidas pela identidade da carga em vez de chaves estáticas.

### Identidade, tenant e recuperação

- A chave do objeto é opaca e criada pelo servidor. Ela inclui um prefixo do `organizationId` para
  operação e diagnóstico, mas o prefixo nunca é fonte de autorização.
- O PostgreSQL registra organização, chave, versão, tamanho, tipo de conteúdo, SHA-256 e vínculo com
  o documento. Consultas autenticadas resolvem esses metadados pelo tenant antes de acessar o
  objeto.
- O download inicial passa pela API, que autoriza o usuário e transmite o conteúdo. Não haverá URL
  pública. URLs pré-assinadas só poderão ser introduzidas com expiração curta, escopo de um objeto e
  auditoria.
- Versionamento fica habilitado. Object Lock não será ativado até a definição jurídica e
  operacional do prazo de retenção, pois o modo de conformidade pode impedir qualquer remoção antes
  do prazo.
- Regras de lifecycle não podem expirar originais enquanto a política fiscal de retenção não estiver
  definida. Versionamento não substitui backup: produção exige cópia ou replicação independente,
  monitoramento e teste periódico de restauração.

### Consistência com o PostgreSQL

S3 e PostgreSQL não participam da mesma transação. A ingestão seguirá uma máquina de estados
idempotente:

1. validar o conteúdo e calcular o hash antes de qualquer efeito de negócio;
2. definir identificadores e uma chave de objeto determinísticos pelo servidor;
3. gravar o objeto e verificar seus metadados;
4. persistir documento, proveniência e referência ao objeto em transação no PostgreSQL;
5. manter o documento sem efeito no estoque até todas as validações e confirmação humana.

Uma falha depois da gravação pode deixar um objeto órfão, nunca um documento confirmado sem objeto.
Retries reutilizam a mesma identidade e o mesmo hash. Uma rotina de reconciliação futura removerá
somente objetos temporários sem referência após uma janela de segurança; não fará exclusão imediata
durante a requisição com falha.

## Alternativas consideradas

### Guardar o conteúdo no PostgreSQL

Rejeitada como solução definitiva. Aumentaria banco, backups e tráfego da fonte transacional sem
oferecer as capacidades próprias de armazenamento de objetos.

### Filesystem local

Rejeitado. Acopla o arquivo a uma instância da API e dificulta concorrência, backup, restauração e
implantação.

### MinIO autogerenciado em produção

Não adotado inicialmente. É tecnicamente compatível, mas transfere à equipe a responsabilidade por
alta disponibilidade, discos, upgrades, replicação e recuperação. Pode ser reconsiderado por nova
ADR se residência, custo ou operação existente justificarem.

### URLs pré-assinadas desde o início

Adiadas. O download mediado pela API simplifica autorização por tenant e auditoria nesta fase. A
troca será possível sem alterar a identidade persistente do objeto.

## Consequências

- Desenvolvimento e CI permanecem locais e reexecutáveis com MinIO.
- Produção evita operar um cluster de objetos sem equipe ou processo dedicado.
- O código não depende de extensões exclusivas do MinIO e mantém portabilidade dentro do subconjunto
  S3 testado.
- A ingestão precisa representar estados intermediários e reconciliação, pois não existe commit
  atômico entre banco e objeto.
- Antes da implementação devem ser definidos o schema persistente, os testes de contrato da porta e
  as variáveis de configuração. Antes de produção também são obrigatórios retenção, backup e ensaio
  de restauração.

## Referências

- [MinIO — Server-Side Encryption](https://github.com/minio/docs/blob/main/source/administration/server-side-encryption/server-side-encryption-sse-s3.rst)
- [MinIO — Object Retention](https://github.com/minio/docs/blob/main/source/administration/object-management/object-retention.rst)
- [AWS SDK for JavaScript v3 — configuração de endpoints](https://github.com/aws/aws-sdk-js-v3/blob/main/supplemental-docs/CLIENTS.md)
