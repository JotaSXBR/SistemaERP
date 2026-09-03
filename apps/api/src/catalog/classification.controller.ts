import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
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
  CreateProductBrandRequestDto,
  CreateProductBrandResponseDto,
  CreateProductCategoryRequestDto,
  CreateProductCategoryResponseDto,
  ProductBrandListResponseDto,
  ProductCategoryListResponseDto,
  UpdateProductBrandRequestDto,
  UpdateProductBrandResponseDto,
  UpdateProductCategoryRequestDto,
  UpdateProductCategoryResponseDto,
} from "./classification.dto.js";
import { ClassificationService } from "./classification.service.js";

const CODE_PATTERN = /^[A-Z0-9][-A-Z0-9._/]{0,39}$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateName(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 120;
}

function validateCreate(body: {
  code?: unknown;
  name?: unknown;
  organizationId?: unknown;
  parentId?: unknown;
}): void {
  if (
    body?.organizationId !== undefined ||
    typeof body?.code !== "string" ||
    !CODE_PATTERN.test(body.code.trim()) ||
    !validateName(body.name) ||
    (body.parentId !== undefined &&
      (typeof body.parentId !== "string" || !UUID_PATTERN.test(body.parentId)))
  ) {
    throw new BadRequestException();
  }
}

function validateUpdate(body: {
  active?: unknown;
  code?: unknown;
  name?: unknown;
  organizationId?: unknown;
  parentId?: unknown;
}): void {
  if (
    body?.organizationId !== undefined ||
    // Código é a chave estável do nó e reparentar exigiria recalcular a profundidade de toda a
    // subárvore; ambos ficam fora deste recorte em vez de serem ignorados em silêncio.
    body?.code !== undefined ||
    body?.parentId !== undefined ||
    (body?.active === undefined && body?.name === undefined) ||
    (body.active !== undefined && typeof body.active !== "boolean") ||
    (body.name !== undefined && !validateName(body.name))
  ) {
    throw new BadRequestException();
  }
}

@ApiBearerAuth()
@ApiTags("catalog")
@Controller("catalog")
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
export class ClassificationController {
  constructor(
    @Inject(ClassificationService) private readonly classification: ClassificationService,
  ) {}

  @Get("categories")
  @ApiQuery({ name: "active", required: false, schema: { type: "boolean" } })
  @ApiOkResponse({ type: ProductCategoryListResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  listCategories(@Query() query: Record<string, unknown>): Promise<ProductCategoryListResponseDto> {
    return this.classification.listCategories(parseBoolean(query.active));
  }

  @Post("categories")
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiBody({ type: CreateProductCategoryRequestDto })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiCreatedResponse({ type: CreateProductCategoryResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  createCategory(
    @Body() body: CreateProductCategoryRequestDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<CreateProductCategoryResponseDto> {
    if (!idempotencyKey) {
      throw new BadRequestException();
    }
    validateCreate(body);

    return this.classification.createCategory(body, idempotencyKey);
  }

  @Patch("categories/:id")
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiParam({ format: "uuid", name: "id", type: String })
  @ApiBody({ type: UpdateProductCategoryRequestDto })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiOkResponse({ type: UpdateProductCategoryResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  updateCategory(
    @Param("id") id: string,
    @Body() body: UpdateProductCategoryRequestDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<UpdateProductCategoryResponseDto> {
    if (!UUID_PATTERN.test(id) || !idempotencyKey) {
      throw new BadRequestException();
    }
    validateUpdate(body);

    return this.classification.updateCategory(id, body, idempotencyKey);
  }

  @Get("brands")
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
    description: "Trecho do código ou do nome da marca",
    name: "search",
    required: false,
    schema: { maxLength: MAX_SEARCH_LENGTH, type: "string" },
  })
  @ApiOkResponse({ type: ProductBrandListResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  listBrands(@Query() query: Record<string, unknown>): Promise<ProductBrandListResponseDto> {
    const page = parsePageRequest(query);
    const active = parseBoolean(query.active);
    const search = parseSearch(query.search);

    return this.classification.listBrands({
      ...page,
      ...(active === undefined ? {} : { active }),
      ...(search ? { search } : {}),
    });
  }

  @Post("brands")
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiBody({ type: CreateProductBrandRequestDto })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiCreatedResponse({ type: CreateProductBrandResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  createBrand(
    @Body() body: CreateProductBrandRequestDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<CreateProductBrandResponseDto> {
    if (!idempotencyKey) {
      throw new BadRequestException();
    }
    validateCreate(body);

    return this.classification.createBrand(body, idempotencyKey);
  }

  @Patch("brands/:id")
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiParam({ format: "uuid", name: "id", type: String })
  @ApiBody({ type: UpdateProductBrandRequestDto })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiOkResponse({ type: UpdateProductBrandResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  updateBrand(
    @Param("id") id: string,
    @Body() body: UpdateProductBrandRequestDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<UpdateProductBrandResponseDto> {
    if (!UUID_PATTERN.test(id) || !idempotencyKey) {
      throw new BadRequestException();
    }
    validateUpdate(body);

    return this.classification.updateBrand(id, body, idempotencyKey);
  }
}
