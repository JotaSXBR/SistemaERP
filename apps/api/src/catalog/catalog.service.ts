import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PartnerRole, Prisma, ProductConversionMode } from "@sistema-erp/database";

import { DatabaseService } from "../database/database.service.js";
import { IdempotencyService } from "../idempotency/idempotency.service.js";
import { normalizeTaxId } from "../partners/tax-id.js";
import { RequestContextService } from "../request-context/request-context.service.js";
import type {
  CreateProductRequestDto,
  CreateProductResponseDto,
  CreateSupplierProductMappingRequestDto,
  CreateSupplierProductMappingResponseDto,
  ProductBrandRefDto,
  ProductCategoryRefDto,
  ProductDetailDto,
  ProductDto,
  ProductGeometryDto,
  ProductListResponseDto,
  ResolveSupplierProductResponseDto,
  SupplierProductMappingDto,
  UnitOfMeasureDto,
  UpdateProductResponseDto,
} from "./catalog.dto.js";

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

type ListProductsInput = {
  active?: boolean;
  categoryId?: string;
  limit: number;
  offset: number;
  search?: string;
};

type UpdateProductInput = {
  active?: boolean;
  /**
   * Conjunto completo de facetas do produto: o que vier substitui o que existia, e um array vazio
   * remove todas. Ausente não mexe nas facetas — a semântica de conjunto evita um PATCH que
   * precisasse dizer separadamente o que adicionar e o que remover.
   */
  attributes?: Array<{ definitionId: string; optionId: string }>;
  brandId?: string | null;
  categoryId?: string | null;
  /**
   * Geometria campo a campo: o que vier e gravado, `null` limpa a medida e o que ficar de fora nao
   * muda. Diferente das facetas de proposito — la o array e o conjunto inteiro, aqui cada medida e
   * independente e a edicao parcial e o caso comum.
   */
  geometry?: Partial<Record<GeometryField, string | null>>;
  shortDescription?: string;
  technicalDescription?: string;
};

/**
 * As oito medidas da ADR-0010. Manter a lista em um so lugar evita que resposta, gravacao e
 * auditoria divirjam quando uma medida nova for acrescentada.
 */
const GEOMETRY_FIELDS = [
  "heightMm",
  "innerDiameterMm",
  "lengthMm",
  "outerDiameterMm",
  "thicknessMm",
  "weightPerMeterKg",
  "weightPerSquareMeterKg",
  "widthMm",
] as const;

export type GeometryField = (typeof GEOMETRY_FIELDS)[number];

type PersistedUnit = {
  code: string;
  decimalScale: number;
  id: string;
  name: string;
};

function unitResponse(unit: PersistedUnit): UnitOfMeasureDto {
  return {
    code: unit.code,
    decimalScale: unit.decimalScale,
    id: unit.id,
    name: unit.name,
  };
}

type ProductWithDetail = Prisma.ProductGetPayload<{
  include: typeof PRODUCT_DETAIL_INCLUDE;
}>;

const PRODUCT_DETAIL_INCLUDE = {
  attributes: {
    include: { definition: true, option: true },
    orderBy: [{ definitionId: "asc" }],
  },
  baseUnit: true,
  brand: true,
  category: { include: { parent: { include: { parent: true } } } },
  presentations: {
    include: { unitOfMeasure: true },
    orderBy: [{ code: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.ProductInclude;

type PersistedCategoryNode = {
  code: string;
  id: string;
  name: string;
  parent?: PersistedCategoryNode | null;
};

function brandRef(
  brand: { code: string; id: string; name: string } | null,
): ProductBrandRefDto | undefined {
  return brand ? { code: brand.code, id: brand.id, name: brand.name } : undefined;
}

/**
 * O caminho e montado a partir dos ancestrais ja carregados pelo include. A taxonomia tem no maximo
 * MAX_CATEGORY_DEPTH niveis, entao um include aninhado basta e evita uma consulta por produto.
 */
function categoryRef(category: PersistedCategoryNode | null): ProductCategoryRefDto | undefined {
  if (!category) return undefined;

  const path: string[] = [];
  let current: PersistedCategoryNode | null | undefined = category;
  while (current) {
    path.unshift(current.name);
    current = current.parent;
  }

  return { code: category.code, id: category.id, name: category.name, path };
}

/**
 * Decimal nulo some da resposta em vez de virar `null` ou `0`: a ADR-0010 distingue "nao se aplica"
 * de uma medida real, e zero seria uma medida real. O valor sai como string para nao passar por
 * ponto flutuante — ele entra em calculo de preco do outro lado.
 */
function geometryResponse(product: {
  [K in GeometryField]: Prisma.Decimal | null;
}): ProductGeometryDto {
  const geometry: ProductGeometryDto = {};
  for (const field of GEOMETRY_FIELDS) {
    const value = product[field];
    if (value !== null) {
      geometry[field] = value.toString();
    }
  }

  return geometry;
}

/**
 * Traduz a geometria recebida para o `data` do update. Medida ausente nao entra no objeto, entao a
 * coluna nao e tocada; `null` explicito vira `null` no banco e limpa a medida.
 */
function geometryUpdateData(
  geometry: Partial<Record<GeometryField, string | null>> | undefined,
): Partial<Record<GeometryField, string | null>> {
  if (!geometry) return {};

  const data: Partial<Record<GeometryField, string | null>> = {};
  for (const field of GEOMETRY_FIELDS) {
    const value = geometry[field];
    if (value !== undefined) {
      data[field] = value;
    }
  }

  return data;
}

/** Compara o que foi pedido com o que ja estava gravado, para a auditoria nao mentir sobre mudanca. */
function changedGeometryFields(
  geometry: Partial<Record<GeometryField, string | null>> | undefined,
  existing: { [K in GeometryField]: Prisma.Decimal | null },
): GeometryField[] {
  if (!geometry) return [];

  return GEOMETRY_FIELDS.filter((field) => {
    const value = geometry[field];
    if (value === undefined) return false;

    const current = existing[field];
    if (value === null) return current !== null;

    // Comparacao decimal, e nao textual: "3.18" e "3.1800000000" sao o mesmo numero, e a coluna
    // devolve a forma com escala completa.
    return current === null || !current.equals(new Prisma.Decimal(value));
  });
}

function productDetailResponse(product: ProductWithDetail): ProductDetailDto {
  return {
    active: product.active,
    attributes: product.attributes.map((assignment) => ({
      definitionCode: assignment.definition.code,
      definitionId: assignment.definitionId,
      definitionName: assignment.definition.name,
      optionCode: assignment.option.code,
      optionId: assignment.optionId,
      optionName: assignment.option.name,
    })),
    baseUnit: unitResponse(product.baseUnit),
    ...(brandRef(product.brand) ? { brand: brandRef(product.brand)! } : {}),
    ...(categoryRef(product.category) ? { category: categoryRef(product.category)! } : {}),
    geometry: geometryResponse(product),
    id: product.id,
    presentations: product.presentations.map((presentation) => ({
      code: presentation.code,
      ...(presentation.conversionFactor
        ? { conversionFactor: presentation.conversionFactor.toString() }
        : {}),
      conversionMode: presentation.conversionMode,
      id: presentation.id,
      name: presentation.name,
      unit: unitResponse(presentation.unitOfMeasure),
    })),
    shortDescription: product.shortDescription,
    sku: product.sku,
    ...(product.technicalDescription ? { technicalDescription: product.technicalDescription } : {}),
  };
}

type MappingWithRelations = Prisma.SupplierProductMappingGetPayload<{
  include: {
    productPresentation: { include: { product: true; unitOfMeasure: true } };
  };
}>;

export type SupplierProductResolution =
  | {
      mapping: SupplierProductMappingDto;
      status: "MATCHED";
      supplierCode: string;
    }
  | {
      status: "SUPPLIER_NOT_FOUND" | "UNMAPPED";
      supplierCode: string;
    };

export type SupplierDocumentResolution = {
  resolutions: SupplierProductResolution[];
  supplierId?: string;
  supplierStatus: "FOUND" | "INACTIVE" | "MISSING_SUPPLIER_ROLE" | "NOT_FOUND";
};

function mappingResponse(mapping: MappingWithRelations): Prisma.JsonObject {
  const { product, unitOfMeasure } = mapping.productPresentation;

  return {
    active: mapping.active,
    id: mapping.id,
    product: {
      presentationCode: mapping.productPresentation.code,
      presentationId: mapping.productPresentation.id,
      presentationName: mapping.productPresentation.name,
      productId: product.id,
      shortDescription: product.shortDescription,
      sku: product.sku,
      unit: {
        code: unitOfMeasure.code,
        decimalScale: unitOfMeasure.decimalScale,
        id: unitOfMeasure.id,
        name: unitOfMeasure.name,
      },
    },
    supplierCode: mapping.supplierCode,
    supplierId: mapping.supplierId,
  };
}

@Injectable()
export class CatalogService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
    @Inject(RequestContextService) private readonly requestContext: RequestContextService,
  ) {}

  async listProducts(input: ListProductsInput): Promise<ProductListResponseDto> {
    const { organizationId } = this.requestContext.getAuthenticated();
    const categoryIds = input.categoryId
      ? await this.categorySubtreeIds(organizationId, input.categoryId)
      : undefined;
    const where: Prisma.ProductWhereInput = {
      organizationId,
      ...(input.active === undefined ? {} : { active: input.active }),
      ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
      ...(input.search
        ? {
            OR: [
              { shortDescription: { contains: input.search, mode: "insensitive" } },
              { sku: { contains: normalizeCode(input.search) } },
            ],
          }
        : {}),
    };
    const [products, total] = await Promise.all([
      this.database.value.product.findMany({
        include: {
          baseUnit: true,
          brand: true,
          category: { include: { parent: { include: { parent: true } } } },
        },
        orderBy: [{ shortDescription: "asc" }, { id: "asc" }],
        skip: input.offset,
        take: input.limit,
        where,
      }),
      this.database.value.product.count({ where }),
    ]);

    return {
      items: products.map((product) => ({
        active: product.active,
        baseUnit: unitResponse(product.baseUnit),
        ...(brandRef(product.brand) ? { brand: brandRef(product.brand)! } : {}),
        ...(categoryRef(product.category) ? { category: categoryRef(product.category)! } : {}),
        id: product.id,
        shortDescription: product.shortDescription,
        sku: product.sku,
      })),
      limit: input.limit,
      offset: input.offset,
      total,
    };
  }

  /**
   * Filtrar por um no da taxonomia deve trazer tambem os produtos dos descendentes: escolher
   * "Metais" precisa incluir "Chapas" e "Galvanizada". A taxonomia e pequena, entao ela e carregada
   * inteira e percorrida em memoria em vez de gerar uma consulta recursiva.
   */
  private async categorySubtreeIds(organizationId: string, rootId: string): Promise<string[]> {
    const categories = await this.database.value.productCategory.findMany({
      select: { id: true, parentId: true },
      where: { organizationId },
    });
    const childrenByParent = new Map<string, string[]>();
    for (const category of categories) {
      if (!category.parentId) continue;
      const siblings = childrenByParent.get(category.parentId) ?? [];
      siblings.push(category.id);
      childrenByParent.set(category.parentId, siblings);
    }

    const subtree: string[] = [];
    const pending = [rootId];
    while (pending.length > 0) {
      const current = pending.pop()!;
      subtree.push(current);
      pending.push(...(childrenByParent.get(current) ?? []));
    }

    return subtree;
  }

  async findProductById(id: string): Promise<ProductDetailDto> {
    const { organizationId } = this.requestContext.getAuthenticated();
    const product = await this.database.value.product.findUnique({
      include: PRODUCT_DETAIL_INCLUDE,
      where: { id_organizationId: { id, organizationId } },
    });

    if (!product) {
      throw new NotFoundException();
    }

    return productDetailResponse(product);
  }

  async createProduct(
    input: CreateProductRequestDto,
    key: string,
  ): Promise<CreateProductResponseDto> {
    const normalizedInput = {
      baseUnit: {
        code: normalizeCode(input.baseUnit.code),
        decimalScale: input.baseUnit.decimalScale ?? 4,
        name: input.baseUnit.name.trim(),
      },
      ...(input.brandId ? { brandId: input.brandId } : {}),
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      shortDescription: input.shortDescription.trim(),
      sku: normalizeCode(input.sku),
      ...(input.technicalDescription?.trim()
        ? { technicalDescription: input.technicalDescription.trim() }
        : {}),
    };
    const result = await this.idempotency.execute({
      key,
      operation: "catalog.products.create",
      request: normalizedInput,
      run: async (transaction) => this.createProductTransaction(transaction, normalizedInput),
    });

    return { product: result.data as unknown as ProductDto, replayed: result.replayed };
  }

  async updateProduct(
    id: string,
    input: UpdateProductInput,
    key: string,
  ): Promise<UpdateProductResponseDto> {
    const normalizedInput = {
      id,
      ...(input.active === undefined ? {} : { active: input.active }),
      ...(input.attributes === undefined ? {} : { attributes: input.attributes }),
      ...(input.brandId === undefined ? {} : { brandId: input.brandId }),
      ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
      ...(input.geometry === undefined ? {} : { geometry: input.geometry }),
      ...(input.shortDescription === undefined
        ? {}
        : { shortDescription: input.shortDescription.trim() }),
      ...(input.technicalDescription === undefined
        ? {}
        : { technicalDescription: input.technicalDescription.trim() }),
    };
    const result = await this.idempotency.execute({
      key,
      operation: "catalog.products.update",
      request: normalizedInput,
      responseStatus: 200,
      run: async (transaction) => this.updateProductTransaction(transaction, normalizedInput),
    });

    return { product: result.data as unknown as ProductDetailDto, replayed: result.replayed };
  }

  async createSupplierMapping(
    input: CreateSupplierProductMappingRequestDto,
    key: string,
  ): Promise<CreateSupplierProductMappingResponseDto> {
    const normalizedInput = {
      productPresentationId: input.productPresentationId,
      supplierCode: input.supplierCode.trim(),
      supplierId: input.supplierId,
    };
    const result = await this.idempotency.execute({
      key,
      operation: "catalog.supplier-product-mappings.create",
      request: normalizedInput,
      run: async (transaction) => this.createMappingTransaction(transaction, normalizedInput),
    });

    return {
      mapping: result.data as unknown as SupplierProductMappingDto,
      replayed: result.replayed,
    };
  }

  async resolveSupplierProduct(
    supplierTaxId: string,
    supplierCode: string,
  ): Promise<ResolveSupplierProductResponseDto> {
    const [resolution] = await this.resolveSupplierProducts(supplierTaxId, [supplierCode]);

    if (!resolution) {
      return { status: "UNMAPPED" };
    }

    return resolution.status === "MATCHED"
      ? { mapping: resolution.mapping, status: resolution.status }
      : { status: resolution.status };
  }

  async resolveSupplierProducts(
    supplierTaxId: string,
    supplierCodes: readonly string[],
  ): Promise<SupplierProductResolution[]> {
    return (await this.resolveSupplierDocument(supplierTaxId, supplierCodes)).resolutions;
  }

  async resolveSupplierDocument(
    supplierTaxId: string,
    supplierCodes: readonly string[],
  ): Promise<SupplierDocumentResolution> {
    if (supplierCodes.length === 0) {
      return { resolutions: [], supplierStatus: "NOT_FOUND" };
    }

    const { organizationId } = this.requestContext.getAuthenticated();
    const supplier = await this.database.value.partner.findUnique({
      where: {
        organizationId_taxId: { organizationId, taxId: normalizeTaxId(supplierTaxId) },
      },
    });

    const unresolved = supplierCodes.map((supplierCode) => ({
      status: "SUPPLIER_NOT_FOUND" as const,
      supplierCode,
    }));
    if (!supplier) {
      return { resolutions: unresolved, supplierStatus: "NOT_FOUND" };
    }
    if (!supplier.active) {
      return {
        resolutions: unresolved,
        supplierId: supplier.id,
        supplierStatus: "INACTIVE",
      };
    }
    if (!supplier.roles.includes(PartnerRole.SUPPLIER)) {
      return {
        resolutions: unresolved,
        supplierId: supplier.id,
        supplierStatus: "MISSING_SUPPLIER_ROLE",
      };
    }

    const normalizedCodes = supplierCodes.map(normalizeCode);
    const mappings = await this.database.value.supplierProductMapping.findMany({
      include: { productPresentation: { include: { product: true, unitOfMeasure: true } } },
      where: {
        normalizedSupplierCode: { in: [...new Set(normalizedCodes)] },
        organizationId,
        supplierId: supplier.id,
      },
    });
    const mappingsByCode = new Map(
      mappings.map((mapping) => [mapping.normalizedSupplierCode, mapping] as const),
    );

    const resolutions: SupplierProductResolution[] = supplierCodes.map((supplierCode, index) => {
      const mapping = mappingsByCode.get(normalizedCodes[index] ?? "");

      if (
        !mapping?.active ||
        !mapping.productPresentation.active ||
        !mapping.productPresentation.product.active
      ) {
        return { status: "UNMAPPED" as const, supplierCode };
      }

      return {
        mapping: mappingResponse(mapping) as unknown as SupplierProductMappingDto,
        status: "MATCHED" as const,
        supplierCode,
      };
    });

    return { resolutions, supplierId: supplier.id, supplierStatus: "FOUND" };
  }

  private async updateProductTransaction(
    transaction: Prisma.TransactionClient,
    input: UpdateProductInput & { id: string },
  ): Promise<Prisma.JsonObject> {
    const context = this.requestContext.getAuthenticated();
    const where = {
      id_organizationId: { id: input.id, organizationId: context.organizationId },
    };
    const existing = await transaction.product.findUnique({ where });
    if (!existing) {
      throw new NotFoundException();
    }

    // SKU e unidade base permanecem imutáveis: ambos são referenciados por apresentações e
    // mapeamentos de fornecedor, e trocá-los reescreveria o significado de dados já persistidos.
    await this.assertClassificationExists(transaction, context.organizationId, {
      ...(input.brandId ? { brandId: input.brandId } : {}),
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    });

    if (input.attributes) {
      await this.replaceAttributes(transaction, context.organizationId, input.id, input.attributes);
    }

    const product = await transaction.product.update({
      data: {
        ...(input.active === undefined ? {} : { active: input.active }),
        ...(input.brandId === undefined ? {} : { brandId: input.brandId }),
        ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
        ...geometryUpdateData(input.geometry),
        ...(input.shortDescription === undefined
          ? {}
          : { shortDescription: input.shortDescription }),
        ...(input.technicalDescription === undefined
          ? {}
          : { technicalDescription: input.technicalDescription || null }),
      },
      include: PRODUCT_DETAIL_INCLUDE,
      where,
    });
    const response = productDetailResponse(product) as unknown as Prisma.JsonObject;

    await transaction.auditEvent.create({
      data: {
        action: "catalog.products.updated",
        actorUserId: context.userId,
        correlationId: context.correlationId,
        entityId: product.id,
        entityType: "product",
        metadata: {
          activeChanged: input.active !== undefined && input.active !== existing.active,
          geometryChanged: changedGeometryFields(input.geometry, existing),
          shortDescriptionChanged:
            input.shortDescription !== undefined &&
            input.shortDescription !== existing.shortDescription,
          sku: product.sku,
          technicalDescriptionChanged:
            input.technicalDescription !== undefined &&
            (input.technicalDescription || null) !== existing.technicalDescription,
        },
        organizationId: context.organizationId,
        requestId: context.requestId,
      },
    });

    return response;
  }

  /**
   * Categoria e marca precisam pertencer ao mesmo tenant. A FK composta ja impede o vinculo entre
   * organizacoes, mas checar aqui devolve 404 em vez de deixar o banco lancar erro de constraint.
   */
  /**
   * Substitui o conjunto de facetas do produto. As opções são conferidas uma a uma para devolver
   * `404` em vez de deixar a FK composta estourar erro de constraint — ela continua sendo a
   * garantia final de que a opção pertence ao eixo declarado.
   */
  private async replaceAttributes(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    productId: string,
    attributes: Array<{ definitionId: string; optionId: string }>,
  ): Promise<void> {
    const seen = new Set<string>();
    for (const attribute of attributes) {
      if (seen.has(attribute.definitionId)) {
        // Dois valores para o mesmo eixo: a unicidade do banco recusaria, mas o conflito é do
        // pedido, não do estado, então responde 409 antes de tentar gravar.
        throw new ConflictException();
      }
      seen.add(attribute.definitionId);

      const option = await transaction.productAttributeOption.findUnique({
        where: { id_organizationId: { id: attribute.optionId, organizationId } },
      });
      if (!option || option.definitionId !== attribute.definitionId) {
        throw new NotFoundException();
      }
    }

    await transaction.productAttribute.deleteMany({ where: { organizationId, productId } });
    if (attributes.length > 0) {
      await transaction.productAttribute.createMany({
        data: attributes.map((attribute) => ({
          definitionId: attribute.definitionId,
          optionId: attribute.optionId,
          organizationId,
          productId,
        })),
      });
    }
  }

  private async assertClassificationExists(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    input: { brandId?: string | null; categoryId?: string | null },
  ): Promise<void> {
    if (input.categoryId) {
      const category = await transaction.productCategory.findUnique({
        where: { id_organizationId: { id: input.categoryId, organizationId } },
      });
      if (!category) {
        throw new NotFoundException();
      }
    }

    if (input.brandId) {
      const brand = await transaction.productBrand.findUnique({
        where: { id_organizationId: { id: input.brandId, organizationId } },
      });
      if (!brand) {
        throw new NotFoundException();
      }
    }
  }

  private async createProductTransaction(
    transaction: Prisma.TransactionClient,
    input: {
      baseUnit: { code: string; decimalScale: number; name: string };
      brandId?: string;
      categoryId?: string;
      shortDescription: string;
      sku: string;
      technicalDescription?: string;
    },
  ): Promise<Prisma.JsonObject> {
    const context = this.requestContext.getAuthenticated();
    const existingProduct = await transaction.product.findUnique({
      where: { organizationId_sku: { organizationId: context.organizationId, sku: input.sku } },
    });
    if (existingProduct) {
      throw new ConflictException();
    }

    const existingUnit = await transaction.unitOfMeasure.findUnique({
      where: {
        organizationId_code: {
          code: input.baseUnit.code,
          organizationId: context.organizationId,
        },
      },
    });
    if (
      existingUnit &&
      (existingUnit.name !== input.baseUnit.name ||
        existingUnit.decimalScale !== input.baseUnit.decimalScale)
    ) {
      throw new ConflictException();
    }

    const unit =
      existingUnit ??
      (await transaction.unitOfMeasure.create({
        data: { ...input.baseUnit, organizationId: context.organizationId },
      }));
    await this.assertClassificationExists(transaction, context.organizationId, {
      ...(input.brandId ? { brandId: input.brandId } : {}),
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    });

    const product = await transaction.product.create({
      data: {
        baseUnitId: unit.id,
        organizationId: context.organizationId,
        shortDescription: input.shortDescription,
        sku: input.sku,
        ...(input.brandId ? { brandId: input.brandId } : {}),
        ...(input.categoryId ? { categoryId: input.categoryId } : {}),
        ...(input.technicalDescription ? { technicalDescription: input.technicalDescription } : {}),
      },
    });
    const presentation = await transaction.productPresentation.create({
      data: {
        code: "BASE",
        conversionFactor: "1",
        conversionMode: ProductConversionMode.FIXED,
        name: "Apresentação base",
        organizationId: context.organizationId,
        productId: product.id,
        unitOfMeasureId: unit.id,
      },
    });
    const response: Prisma.JsonObject = {
      active: product.active,
      basePresentation: {
        code: presentation.code,
        conversionFactor: presentation.conversionFactor?.toString() ?? "1",
        conversionMode: presentation.conversionMode,
        id: presentation.id,
        name: presentation.name,
        unit: {
          code: unit.code,
          decimalScale: unit.decimalScale,
          id: unit.id,
          name: unit.name,
        },
      },
      baseUnit: {
        code: unit.code,
        decimalScale: unit.decimalScale,
        id: unit.id,
        name: unit.name,
      },
      id: product.id,
      shortDescription: product.shortDescription,
      sku: product.sku,
      ...(product.technicalDescription
        ? { technicalDescription: product.technicalDescription }
        : {}),
    };

    await transaction.auditEvent.create({
      data: {
        action: "catalog.products.created",
        actorUserId: context.userId,
        correlationId: context.correlationId,
        entityId: product.id,
        entityType: "product",
        metadata: { baseUnitCode: unit.code, sku: product.sku },
        organizationId: context.organizationId,
        requestId: context.requestId,
      },
    });

    return response;
  }

  private async createMappingTransaction(
    transaction: Prisma.TransactionClient,
    input: CreateSupplierProductMappingRequestDto,
  ): Promise<Prisma.JsonObject> {
    const context = this.requestContext.getAuthenticated();
    const [supplier, presentation] = await Promise.all([
      transaction.partner.findUnique({
        where: {
          id_organizationId: { id: input.supplierId, organizationId: context.organizationId },
        },
      }),
      transaction.productPresentation.findUnique({
        include: { product: true, unitOfMeasure: true },
        where: {
          id_organizationId: {
            id: input.productPresentationId,
            organizationId: context.organizationId,
          },
        },
      }),
    ]);

    if (
      !supplier?.active ||
      !supplier.roles.includes(PartnerRole.SUPPLIER) ||
      !presentation?.active
    ) {
      throw new NotFoundException();
    }

    const normalizedSupplierCode = normalizeCode(input.supplierCode);
    const existing = await transaction.supplierProductMapping.findUnique({
      where: {
        organizationId_supplierId_normalizedSupplierCode: {
          normalizedSupplierCode,
          organizationId: context.organizationId,
          supplierId: supplier.id,
        },
      },
    });
    if (existing) {
      throw new ConflictException();
    }

    const mapping = await transaction.supplierProductMapping.create({
      data: {
        normalizedSupplierCode,
        organizationId: context.organizationId,
        productPresentationId: presentation.id,
        supplierCode: input.supplierCode,
        supplierId: supplier.id,
      },
      include: { productPresentation: { include: { product: true, unitOfMeasure: true } } },
    });

    await transaction.auditEvent.create({
      data: {
        action: "catalog.supplier-product-mappings.created",
        actorUserId: context.userId,
        correlationId: context.correlationId,
        entityId: mapping.id,
        entityType: "supplier_product_mapping",
        metadata: {
          productPresentationId: mapping.productPresentationId,
          supplierId: mapping.supplierId,
        },
        organizationId: context.organizationId,
        requestId: context.requestId,
      },
    });

    return mappingResponse(mapping);
  }
}
