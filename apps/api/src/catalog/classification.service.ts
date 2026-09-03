import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { type Prisma } from "@sistema-erp/database";

import { DatabaseService } from "../database/database.service.js";
import { IdempotencyService } from "../idempotency/idempotency.service.js";
import { RequestContextService } from "../request-context/request-context.service.js";
import type {
  CreateProductBrandResponseDto,
  CreateProductCategoryResponseDto,
  ProductBrandDto,
  ProductBrandListResponseDto,
  ProductCategoryDto,
  ProductCategoryListResponseDto,
  UpdateProductBrandResponseDto,
  UpdateProductCategoryResponseDto,
} from "./classification.dto.js";

/**
 * Profundidade máxima da taxonomia, replicada como CHECK em `product_categories`. Cinco níveis
 * cobrem família, grupo e subgrupo com folga e mantêm o caminho barato de montar.
 */
export const MAX_CATEGORY_DEPTH = 5;

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

type PersistedCategory = {
  active: boolean;
  code: string;
  depth: number;
  id: string;
  name: string;
  parentId: string | null;
};

type PersistedBrand = {
  active: boolean;
  code: string;
  id: string;
  name: string;
};

function brandResponse(brand: PersistedBrand): ProductBrandDto {
  return { active: brand.active, code: brand.code, id: brand.id, name: brand.name };
}

/**
 * Monta o caminho da raiz até o nó. Recebe a taxonomia do tenant já carregada, porque subir a
 * árvore nó a nó geraria uma consulta por nível.
 */
function categoryPath(category: PersistedCategory, byId: Map<string, PersistedCategory>): string[] {
  const path = [category.name];
  let current = category;

  while (current.parentId) {
    const parent = byId.get(current.parentId);
    if (!parent) break;
    path.unshift(parent.name);
    current = parent;
  }

  return path;
}

function categoryResponse(
  category: PersistedCategory,
  byId: Map<string, PersistedCategory>,
): ProductCategoryDto {
  return {
    active: category.active,
    code: category.code,
    depth: category.depth,
    id: category.id,
    name: category.name,
    ...(category.parentId ? { parentId: category.parentId } : {}),
    path: categoryPath(category, byId),
  };
}

@Injectable()
export class ClassificationService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
    @Inject(RequestContextService) private readonly requestContext: RequestContextService,
  ) {}

  async listCategories(active?: boolean): Promise<ProductCategoryListResponseDto> {
    const { organizationId } = this.requestContext.getAuthenticated();
    // A taxonomia é pequena e o caminho de cada nó depende dos ancestrais, então ela é carregada
    // inteira em vez de paginada.
    const categories = await this.database.value.productCategory.findMany({
      orderBy: [{ depth: "asc" }, { name: "asc" }, { id: "asc" }],
      where: { organizationId, ...(active === undefined ? {} : { active }) },
    });
    const byId = new Map(categories.map((category) => [category.id, category]));

    return {
      items: categories
        .map((category) => categoryResponse(category, byId))
        .sort((left, right) => left.path.join("/").localeCompare(right.path.join("/"))),
    };
  }

  async listBrands(input: {
    active?: boolean;
    limit: number;
    offset: number;
    search?: string;
  }): Promise<ProductBrandListResponseDto> {
    const { organizationId } = this.requestContext.getAuthenticated();
    const where: Prisma.ProductBrandWhereInput = {
      organizationId,
      ...(input.active === undefined ? {} : { active: input.active }),
      ...(input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: "insensitive" } },
              { code: { contains: normalizeCode(input.search) } },
            ],
          }
        : {}),
    };
    const [brands, total] = await Promise.all([
      this.database.value.productBrand.findMany({
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip: input.offset,
        take: input.limit,
        where,
      }),
      this.database.value.productBrand.count({ where }),
    ]);

    return { items: brands.map(brandResponse), limit: input.limit, offset: input.offset, total };
  }

  async createCategory(
    input: { code: string; name: string; parentId?: string },
    key: string,
  ): Promise<CreateProductCategoryResponseDto> {
    const normalizedInput = {
      code: normalizeCode(input.code),
      name: input.name.trim(),
      ...(input.parentId ? { parentId: input.parentId } : {}),
    };
    const result = await this.idempotency.execute({
      key,
      operation: "catalog.categories.create",
      request: normalizedInput,
      run: async (transaction) => this.createCategoryTransaction(transaction, normalizedInput),
    });

    return { category: result.data as unknown as ProductCategoryDto, replayed: result.replayed };
  }

  async updateCategory(
    id: string,
    input: { active?: boolean; name?: string },
    key: string,
  ): Promise<UpdateProductCategoryResponseDto> {
    const normalizedInput = {
      id,
      ...(input.active === undefined ? {} : { active: input.active }),
      ...(input.name === undefined ? {} : { name: input.name.trim() }),
    };
    const result = await this.idempotency.execute({
      key,
      operation: "catalog.categories.update",
      request: normalizedInput,
      responseStatus: 200,
      run: async (transaction) => this.updateCategoryTransaction(transaction, normalizedInput),
    });

    return { category: result.data as unknown as ProductCategoryDto, replayed: result.replayed };
  }

  async createBrand(
    input: { code: string; name: string },
    key: string,
  ): Promise<CreateProductBrandResponseDto> {
    const normalizedInput = { code: normalizeCode(input.code), name: input.name.trim() };
    const result = await this.idempotency.execute({
      key,
      operation: "catalog.brands.create",
      request: normalizedInput,
      run: async (transaction) => this.createBrandTransaction(transaction, normalizedInput),
    });

    return { brand: result.data as unknown as ProductBrandDto, replayed: result.replayed };
  }

  async updateBrand(
    id: string,
    input: { active?: boolean; name?: string },
    key: string,
  ): Promise<UpdateProductBrandResponseDto> {
    const normalizedInput = {
      id,
      ...(input.active === undefined ? {} : { active: input.active }),
      ...(input.name === undefined ? {} : { name: input.name.trim() }),
    };
    const result = await this.idempotency.execute({
      key,
      operation: "catalog.brands.update",
      request: normalizedInput,
      responseStatus: 200,
      run: async (transaction) => this.updateBrandTransaction(transaction, normalizedInput),
    });

    return { brand: result.data as unknown as ProductBrandDto, replayed: result.replayed };
  }

  private async createCategoryTransaction(
    transaction: Prisma.TransactionClient,
    input: { code: string; name: string; parentId?: string },
  ): Promise<Prisma.JsonObject> {
    const context = this.requestContext.getAuthenticated();
    const existing = await transaction.productCategory.findUnique({
      where: { organizationId_code: { code: input.code, organizationId: context.organizationId } },
    });
    if (existing) {
      throw new ConflictException();
    }

    let depth = 0;
    if (input.parentId) {
      const parent = await transaction.productCategory.findUnique({
        where: {
          id_organizationId: { id: input.parentId, organizationId: context.organizationId },
        },
      });
      if (!parent) {
        throw new NotFoundException();
      }
      depth = parent.depth + 1;
      if (depth > MAX_CATEGORY_DEPTH) {
        throw new ConflictException();
      }
    }

    const category = await transaction.productCategory.create({
      data: {
        code: input.code,
        depth,
        name: input.name,
        organizationId: context.organizationId,
        ...(input.parentId ? { parentId: input.parentId } : {}),
      },
    });

    await transaction.auditEvent.create({
      data: {
        action: "catalog.categories.created",
        actorUserId: context.userId,
        correlationId: context.correlationId,
        entityId: category.id,
        entityType: "product_category",
        metadata: { code: category.code, depth: category.depth },
        organizationId: context.organizationId,
        requestId: context.requestId,
      },
    });

    return this.categoryJson(transaction, category, context.organizationId);
  }

  private async updateCategoryTransaction(
    transaction: Prisma.TransactionClient,
    input: { active?: boolean; id: string; name?: string },
  ): Promise<Prisma.JsonObject> {
    const context = this.requestContext.getAuthenticated();
    const where = { id_organizationId: { id: input.id, organizationId: context.organizationId } };
    const existing = await transaction.productCategory.findUnique({ where });
    if (!existing) {
      throw new NotFoundException();
    }

    const category = await transaction.productCategory.update({
      data: {
        ...(input.active === undefined ? {} : { active: input.active }),
        ...(input.name === undefined ? {} : { name: input.name }),
      },
      where,
    });

    await transaction.auditEvent.create({
      data: {
        action: "catalog.categories.updated",
        actorUserId: context.userId,
        correlationId: context.correlationId,
        entityId: category.id,
        entityType: "product_category",
        metadata: {
          activeChanged: input.active !== undefined && input.active !== existing.active,
          code: category.code,
          nameChanged: input.name !== undefined && input.name !== existing.name,
        },
        organizationId: context.organizationId,
        requestId: context.requestId,
      },
    });

    return this.categoryJson(transaction, category, context.organizationId);
  }

  private async createBrandTransaction(
    transaction: Prisma.TransactionClient,
    input: { code: string; name: string },
  ): Promise<Prisma.JsonObject> {
    const context = this.requestContext.getAuthenticated();
    const existing = await transaction.productBrand.findUnique({
      where: { organizationId_code: { code: input.code, organizationId: context.organizationId } },
    });
    if (existing) {
      throw new ConflictException();
    }

    const brand = await transaction.productBrand.create({
      data: { code: input.code, name: input.name, organizationId: context.organizationId },
    });

    await transaction.auditEvent.create({
      data: {
        action: "catalog.brands.created",
        actorUserId: context.userId,
        correlationId: context.correlationId,
        entityId: brand.id,
        entityType: "product_brand",
        metadata: { code: brand.code },
        organizationId: context.organizationId,
        requestId: context.requestId,
      },
    });

    return brandResponse(brand) as unknown as Prisma.JsonObject;
  }

  private async updateBrandTransaction(
    transaction: Prisma.TransactionClient,
    input: { active?: boolean; id: string; name?: string },
  ): Promise<Prisma.JsonObject> {
    const context = this.requestContext.getAuthenticated();
    const where = { id_organizationId: { id: input.id, organizationId: context.organizationId } };
    const existing = await transaction.productBrand.findUnique({ where });
    if (!existing) {
      throw new NotFoundException();
    }

    const brand = await transaction.productBrand.update({
      data: {
        ...(input.active === undefined ? {} : { active: input.active }),
        ...(input.name === undefined ? {} : { name: input.name }),
      },
      where,
    });

    await transaction.auditEvent.create({
      data: {
        action: "catalog.brands.updated",
        actorUserId: context.userId,
        correlationId: context.correlationId,
        entityId: brand.id,
        entityType: "product_brand",
        metadata: {
          activeChanged: input.active !== undefined && input.active !== existing.active,
          code: brand.code,
          nameChanged: input.name !== undefined && input.name !== existing.name,
        },
        organizationId: context.organizationId,
        requestId: context.requestId,
      },
    });

    return brandResponse(brand) as unknown as Prisma.JsonObject;
  }

  private async categoryJson(
    transaction: Prisma.TransactionClient,
    category: PersistedCategory,
    organizationId: string,
  ): Promise<Prisma.JsonObject> {
    const siblings = await transaction.productCategory.findMany({ where: { organizationId } });

    return categoryResponse(
      category,
      new Map(siblings.map((item) => [item.id, item])),
    ) as unknown as Prisma.JsonObject;
  }
}
