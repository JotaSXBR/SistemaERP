import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
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
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { MembershipRole } from "@sistema-erp/database";

import { Roles } from "../authorization/roles.decorator.js";
import { ApiErrorResponseDto } from "../errors/api-error.dto.js";
import {
  CreateProductRequestDto,
  CreateProductResponseDto,
  CreateSupplierProductMappingRequestDto,
  CreateSupplierProductMappingResponseDto,
  ResolveSupplierProductRequestDto,
  ResolveSupplierProductResponseDto,
} from "./catalog.dto.js";
import { CatalogService } from "./catalog.service.js";

const CODE_PATTERN = /^[-A-Za-z0-9._/]{1,120}$/;
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
      (!Number.isInteger(unit.decimalScale) || unit.decimalScale < 0 || unit.decimalScale > 10))
  ) {
    throw new BadRequestException();
  }

  return body;
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
