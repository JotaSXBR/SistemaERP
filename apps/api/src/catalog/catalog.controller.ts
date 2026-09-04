import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { MembershipRole } from "@sistema-erp/database";

import { Roles } from "../authorization/roles.decorator.js";
import { ApiErrorResponseDto } from "../errors/api-error.dto.js";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  MAX_SEARCH_LENGTH,
  parseBoolean,
  parsePageRequest,
  parseSearch,
} from "../pagination/pagination.js";
import {
  CreateProductRequestDto,
  CreateProductResponseDto,
  CreateSupplierProductMappingRequestDto,
  CreateSupplierProductMappingResponseDto,
  ProductDetailResponseDto,
  ProductListResponseDto,
  ResolveSupplierProductRequestDto,
  ResolveSupplierProductResponseDto,
  UpdateProductRequestDto,
  UpdateProductResponseDto,
} from "./catalog.dto.js";
import { CatalogService } from "./catalog.service.js";

const CODE_PATTERN = /^[-A-Za-z0-9._/]{1,120}$/;
/** Casa com `numeric(24, 10)`: até 14 dígitos inteiros e 10 decimais, sem sinal nem notação científica. */
const DECIMAL_PATTERN = /^\d{1,14}(\.\d{1,10})?$/;
/** As oito medidas da ADR-0010; qualquer outra chave no objeto é pedido malformado. */
const GEOMETRY_FIELDS = new Set([
  "heightMm",
  "innerDiameterMm",
  "lengthMm",
  "outerDiameterMm",
  "thicknessMm",
  "weightPerMeterKg",
  "weightPerSquareMeterKg",
  "widthMm",
]);
/** Teto de facetas por produto: mais que isso indica erro de montagem do pedido. */
const MAX_PRODUCT_ATTRIBUTES = 50;
const TAX_ID_PATTERN = /^[-A-Za-z0-9./\s]{11,32}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidSupplierCode(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length >= 1 &&
    trimmed.length <= 120 &&
    [...trimmed].every((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint >= 32 && codePoint !== 127;
    })
  );
}

function validateProduct(body: CreateProductRequestDto): CreateProductRequestDto {
  const candidate = body as CreateProductRequestDto & { organizationId?: unknown };
  const unit = body?.baseUnit as CreateProductRequestDto["baseUnit"] & {
    organizationId?: unknown;
  };

  if (
    candidate.organizationId !== undefined ||
    unit?.organizationId !== undefined ||
    typeof body?.sku !== "string" ||
    !CODE_PATTERN.test(body.sku) ||
    (body.brandId !== undefined &&
      (typeof body.brandId !== "string" || !UUID_PATTERN.test(body.brandId))) ||
    (body.categoryId !== undefined &&
      (typeof body.categoryId !== "string" || !UUID_PATTERN.test(body.categoryId))) ||
    typeof body.shortDescription !== "string" ||
    body.shortDescription.trim().length === 0 ||
    body.shortDescription.trim().length > 240 ||
    (body.technicalDescription !== undefined &&
      (typeof body.technicalDescription !== "string" ||
        body.technicalDescription.length > 4_000)) ||
    typeof unit?.code !== "string" ||
    !CODE_PATTERN.test(unit.code) ||
    unit.code.length > 16 ||
    typeof unit.name !== "string" ||
    unit.name.trim().length === 0 ||
    unit.name.trim().length > 80 ||
    (unit.decimalScale !== undefined &&
      (!Number.isInteger(unit.decimalScale) || unit.decimalScale < 0 || unit.decimalScale > 10)) ||
    // Classificar e medir já no cadastro segue exatamente as regras do update.
    (body.attributes !== undefined && !isAttributeList(body.attributes)) ||
    (body.geometry !== undefined && !isGeometryUpdate(body.geometry))
  ) {
    throw new BadRequestException();
  }

  return body;
}

function validateProductUpdate(body: UpdateProductRequestDto): UpdateProductRequestDto {
  const candidate = body as UpdateProductRequestDto & { organizationId?: unknown; sku?: unknown };

  if (
    candidate.organizationId !== undefined ||
    candidate.sku !== undefined ||
    (body?.active === undefined &&
      body?.attributes === undefined &&
      body?.brandId === undefined &&
      body?.categoryId === undefined &&
      body?.geometry === undefined &&
      body?.shortDescription === undefined &&
      body?.technicalDescription === undefined) ||
    (body.active !== undefined && typeof body.active !== "boolean") ||
    // Nulo remove o vinculo; qualquer outro valor precisa ser um UUID.
    (body.brandId !== undefined &&
      body.brandId !== null &&
      (typeof body.brandId !== "string" || !UUID_PATTERN.test(body.brandId))) ||
    (body.categoryId !== undefined &&
      body.categoryId !== null &&
      (typeof body.categoryId !== "string" || !UUID_PATTERN.test(body.categoryId))) ||
    (body.shortDescription !== undefined &&
      (typeof body.shortDescription !== "string" ||
        body.shortDescription.trim().length === 0 ||
        body.shortDescription.trim().length > 240)) ||
    (body.technicalDescription !== undefined &&
      (typeof body.technicalDescription !== "string" ||
        body.technicalDescription.length > 4_000)) ||
    (body.attributes !== undefined && !isAttributeList(body.attributes)) ||
    (body.geometry !== undefined && !isGeometryUpdate(body.geometry))
  ) {
    throw new BadRequestException();
  }

  return body;
}

/**
 * Confere a forma das medidas. A ADR-0010 proíbe zero como sentinela de "não se aplica" — quem não
 * tem a medida manda `null`, e por isso zero e negativo são recusados aqui. O valor chega como
 * string decimal para não passar por ponto flutuante antes de virar `numeric` no banco.
 */
function isGeometryUpdate(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    return false;
  }

  return entries.every(([field, measure]) => {
    if (!GEOMETRY_FIELDS.has(field)) return false;
    if (measure === null) return true;

    return (
      typeof measure === "string" && DECIMAL_PATTERN.test(measure) && Number.parseFloat(measure) > 0
    );
  });
}

/** Confere apenas a forma; a existência da opção e sua coerência com o eixo ficam no serviço. */
function isAttributeList(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length <= MAX_PRODUCT_ATTRIBUTES &&
    value.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as { definitionId?: unknown }).definitionId === "string" &&
        UUID_PATTERN.test((entry as { definitionId: string }).definitionId) &&
        typeof (entry as { optionId?: unknown }).optionId === "string" &&
        UUID_PATTERN.test((entry as { optionId: string }).optionId),
    )
  );
}

function validateMapping(
  body: CreateSupplierProductMappingRequestDto,
): CreateSupplierProductMappingRequestDto {
  const candidate = body as CreateSupplierProductMappingRequestDto & { organizationId?: unknown };

  if (
    candidate.organizationId !== undefined ||
    typeof body?.supplierId !== "string" ||
    !UUID_PATTERN.test(body.supplierId) ||
    typeof body.productPresentationId !== "string" ||
    !UUID_PATTERN.test(body.productPresentationId) ||
    typeof body.supplierCode !== "string" ||
    !isValidSupplierCode(body.supplierCode)
  ) {
    throw new BadRequestException();
  }

  return body;
}

function validateResolution(
  body: ResolveSupplierProductRequestDto,
): ResolveSupplierProductRequestDto {
  const candidate = body as ResolveSupplierProductRequestDto & { organizationId?: unknown };

  if (
    candidate.organizationId !== undefined ||
    typeof body?.supplierTaxId !== "string" ||
    !TAX_ID_PATTERN.test(body.supplierTaxId) ||
    typeof body.supplierCode !== "string" ||
    !isValidSupplierCode(body.supplierCode)
  ) {
    throw new BadRequestException();
  }

  return body;
}

@ApiBearerAuth()
@ApiTags("catalog")
@Controller("catalog")
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Get("products")
  @ApiQuery({ name: "active", required: false, schema: { type: "boolean" } })
  @ApiQuery({
    name: "limit",
    required: false,
    schema: {
      default: DEFAULT_PAGE_LIMIT,
      maximum: MAX_PAGE_LIMIT,
      minimum: 1,
      type: "integer",
    },
  })
  @ApiQuery({ name: "offset", required: false, schema: { minimum: 0, type: "integer" } })
  @ApiQuery({
    description: "Categoria da taxonomia; inclui os produtos das categorias descendentes",
    name: "categoryId",
    required: false,
    schema: { format: "uuid", type: "string" },
  })
  @ApiQuery({
    description: "Trecho do SKU ou da descrição curta",
    name: "search",
    required: false,
    schema: { maxLength: MAX_SEARCH_LENGTH, type: "string" },
  })
  @ApiOkResponse({ type: ProductListResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  listProducts(@Query() query: Record<string, unknown>): Promise<ProductListResponseDto> {
    const page = parsePageRequest(query);
    const active = parseBoolean(query.active);
    const search = parseSearch(query.search);
    const categoryId = query.categoryId;

    if (
      categoryId !== undefined &&
      categoryId !== "" &&
      (typeof categoryId !== "string" || !UUID_PATTERN.test(categoryId))
    ) {
      throw new BadRequestException();
    }

    return this.catalog.listProducts({
      ...page,
      ...(active === undefined ? {} : { active }),
      ...(categoryId ? { categoryId } : {}),
      ...(search ? { search } : {}),
    });
  }

  @Get("products/:id")
  @ApiParam({ format: "uuid", name: "id", type: String })
  @ApiOkResponse({ type: ProductDetailResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  async findProductById(@Param("id") id: string): Promise<ProductDetailResponseDto> {
    if (!UUID_PATTERN.test(id)) {
      throw new BadRequestException();
    }

    return { product: await this.catalog.findProductById(id) };
  }

  @Patch("products/:id")
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiParam({ format: "uuid", name: "id", type: String })
  @ApiBody({ type: UpdateProductRequestDto })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiOkResponse({ type: UpdateProductResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  updateProduct(
    @Param("id") id: string,
    @Body() body: UpdateProductRequestDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<UpdateProductResponseDto> {
    if (!UUID_PATTERN.test(id) || !idempotencyKey) {
      throw new BadRequestException();
    }

    return this.catalog.updateProduct(id, validateProductUpdate(body), idempotencyKey);
  }

  @Post("products")
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiBody({ type: CreateProductRequestDto })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiCreatedResponse({ type: CreateProductResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  createProduct(
    @Body() body: CreateProductRequestDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<CreateProductResponseDto> {
    if (!idempotencyKey) {
      throw new BadRequestException();
    }

    return this.catalog.createProduct(validateProduct(body), idempotencyKey);
  }

  @Post("supplier-mappings")
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiBody({ type: CreateSupplierProductMappingRequestDto })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiCreatedResponse({ type: CreateSupplierProductMappingResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  createSupplierMapping(
    @Body() body: CreateSupplierProductMappingRequestDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<CreateSupplierProductMappingResponseDto> {
    if (!idempotencyKey) {
      throw new BadRequestException();
    }

    return this.catalog.createSupplierMapping(validateMapping(body), idempotencyKey);
  }

  @Post("supplier-mappings/resolve")
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: ResolveSupplierProductRequestDto })
  @ApiOkResponse({ type: ResolveSupplierProductResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  resolveSupplierProduct(
    @Body() body: ResolveSupplierProductRequestDto,
  ): Promise<ResolveSupplierProductResponseDto> {
    const input = validateResolution(body);
    return this.catalog.resolveSupplierProduct(input.supplierTaxId, input.supplierCode);
  }
}
