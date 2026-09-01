import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PartnerRole, ProductConversionMode, type Prisma } from "@sistema-erp/database";

import { DatabaseService } from "../database/database.service.js";
import { IdempotencyService } from "../idempotency/idempotency.service.js";
import { RequestContextService } from "../request-context/request-context.service.js";
import type {
  CreateProductRequestDto,
  CreateProductResponseDto,
  CreateSupplierProductMappingRequestDto,
  CreateSupplierProductMappingResponseDto,
  ProductDto,
  ResolveSupplierProductResponseDto,
  SupplierProductMappingDto,
} from "./catalog.dto.js";

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeTaxId(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[.\-/\s]/g, "");
}

type MappingWithRelations = Prisma.SupplierProductMappingGetPayload<{
  include: {
    productPresentation: { include: { product: true; unitOfMeasure: true } };
  };
}>;

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
    const { organizationId } = this.requestContext.getAuthenticated();
    const supplier = await this.database.value.partner.findUnique({
      where: {
        organizationId_taxId: { organizationId, taxId: normalizeTaxId(supplierTaxId) },
      },
    });

    if (!supplier?.active || !supplier.roles.includes(PartnerRole.SUPPLIER)) {
      return { status: "SUPPLIER_NOT_FOUND" };
    }

    const mapping = await this.database.value.supplierProductMapping.findUnique({
      include: { productPresentation: { include: { product: true, unitOfMeasure: true } } },
      where: {
        organizationId_supplierId_normalizedSupplierCode: {
          normalizedSupplierCode: normalizeCode(supplierCode),
          organizationId,
          supplierId: supplier.id,
        },
      },
    });

    if (
      !mapping?.active ||
      !mapping.productPresentation.active ||
      !mapping.productPresentation.product.active
    ) {
      return { status: "UNMAPPED" };
    }

    return {
      mapping: mappingResponse(mapping) as unknown as SupplierProductMappingDto,
      status: "MATCHED",
    };
  }

  private async createProductTransaction(
    transaction: Prisma.TransactionClient,
    input: {
      baseUnit: { code: string; decimalScale: number; name: string };
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
    const product = await transaction.product.create({
      data: {
        baseUnitId: unit.id,
        organizationId: context.organizationId,
        shortDescription: input.shortDescription,
        sku: input.sku,
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
