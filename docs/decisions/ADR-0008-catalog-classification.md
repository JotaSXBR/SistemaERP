# ADR-0008 — Classificação do catálogo

- Status: aceito
- Data: 2026-09-03

## Contexto

`docs/product/phase-8-receiving-inventory.md` prevê um catálogo enriquecido com três blocos:
identidade e classificação, atributos fiscais, e geometria/características técnicas. Até aqui o
`Product` só tinha SKU, descrições, unidade base e situação.

O documento de produto já impõe duas restrições que qualquer modelagem precisa respeitar:

> Nem todo produto terá todos os atributos. Não se deve criar uma coluna genérica de texto para
> informações usadas em cálculo, nem preencher medidas inexistentes com zero.

Este ADR decide apenas o bloco de **classificação** (família, grupo e marca/fabricante). Fiscal e
geometria ficam para ADRs próprios, porque têm problemas distintos: vigência no tempo para o perfil
fiscal, e atributos numéricos esparsos com unidade para a geometria.

## Decisão

### Taxonomia hierárquica em uma tabela

`ProductCategory` é auto-relacionada e escopada por organização. Família, grupo e subgrupo são
níveis da mesma árvore, não tabelas diferentes. `Product.categoryId` aponta para um nó de qualquer
profundidade.

A alternativa considerada foi dimensões planas separadas (`ProductFamily`, `ProductGroup`), com o
produto referenciando cada uma. Foi recusada porque fixa o número de níveis no schema: acrescentar
um subgrupo exigiria migration e uma coluna nova, e migrations aqui são imutáveis.

### Marca fora da hierarquia

`ProductBrand` é uma tabela própria. Marca não é um nível da taxonomia: o mesmo grupo tem várias
marcas e a mesma marca aparece em grupos diferentes. Tratá-la como nível produziria duplicação da
árvore inteira por fabricante.

### Profundidade limitada a cinco níveis

`MAX_CATEGORY_DEPTH = 5`, validado no serviço e replicado como CHECK em `product_categories`. O
limite mantém o caminho da raiz até a folha barato de montar — o `include` aninhado da leitura de
produtos tem profundidade fixa — e evita árvores acidentalmente infinitas.

`depth` é denormalizado na linha. É derivável do pai, mas persistir permite ordenar e validar o
limite sem percorrer a árvore, e o CHECK `(parent_id IS NULL AND depth = 0) OR (parent_id IS NOT
NULL AND depth > 0)` impede que a denormalização divirja do pai.

### Código estável e imutável

Categoria e marca têm `code` único por organização, no mesmo padrão de `UnitOfMeasure` e do SKU do
produto. O código não é editável: é a referência estável do nó para integrações e importações. Nome
e situação são editáveis.

### Reparentar fica fora deste recorte

`PATCH` aceita apenas `name` e `active`. Mover um nó exigiria recalcular `depth` de toda a subárvore
e checar ciclos; a rota rejeita `parentId` com `400` em vez de ignorar o campo em silêncio.

### Filtrar por um nó inclui os descendentes

`GET /api/v1/catalog/products?categoryId=...` traz também os produtos das categorias descendentes.
Filtrar por "Metais" e não ver as chapas seria surpreendente. A taxonomia é pequena e limitada a
cinco níveis, então a subárvore é resolvida em memória em vez de por consulta recursiva.

### Vínculo opcional

`categoryId` e `brandId` são nulos por padrão. Produtos que já existiam continuam válidos, e o
documento de produto diz "quando relevantes" — nem toda operação classifica tudo. `null` no `PATCH`
remove o vínculo.

## Consequências

- Acrescentar níveis à taxonomia não exige migration.
- Consultas por classificação sobem um índice `(organization_id, category_id)`.
- A FK composta com `organizationId` impede vínculo entre organizações no banco; o serviço checa
  antes para devolver `404` em vez de erro de constraint.
- Excluir categoria ou marca em uso é bloqueado por `onDelete: Restrict`; desativar é o caminho,
  coerente com "sem apagar referências históricas".
- Reparentar e renomear código continuam pendentes e precisarão de um recorte próprio.
