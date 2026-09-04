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
import { parseBoolean } from "../pagination/pagination.js";
import {
  CreateProductAttributeDefinitionRequestDto,
  CreateProductAttributeDefinitionResponseDto,
  CreateProductAttributeOptionRequestDto,
  CreateProductAttributeOptionResponseDto,
  ProductAttributeDefinitionListResponseDto,
  UpdateProductAttributeDefinitionRequestDto,
  UpdateProductAttributeDefinitionResponseDto,
  UpdateProductAttributeOptionRequestDto,
  UpdateProductAttributeOptionResponseDto,
} from "./attributes.dto.js";
import { AttributesService } from "./attributes.service.js";

const CODE_PATTERN = /^[A-Z0-9][-A-Z0-9._/]{0,39}$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateName(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 120;
}

function validateCreate(body: { code?: unknown; name?: unknown }): void {
  const candidate = body as { organizationId?: unknown };

  if (
    candidate.organizationId !== undefined ||
    typeof body?.code !== "string" ||
    !CODE_PATTERN.test(body.code.trim()) ||
    !validateName(body.name)
  ) {
    throw new BadRequestException();
  }
}

function validateUpdate(body: { active?: unknown; name?: unknown }): void {
  const candidate = body as { code?: unknown; organizationId?: unknown };

  if (
    candidate.organizationId !== undefined ||
    // O código é a referência estável do eixo para importações; trocá-lo quebraria vínculos já
    // gravados, então a rota recusa em vez de ignorar o campo em silêncio.
    candidate.code !== undefined ||
    (body.active === undefined && body.name === undefined) ||
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
export class AttributesController {
  constructor(@Inject(AttributesService) private readonly attributes: AttributesService) {}

  @Get("attribute-definitions")
  @ApiQuery({ name: "active", required: false, schema: { type: "boolean" } })
  @ApiOkResponse({ type: ProductAttributeDefinitionListResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  listDefinitions(
    @Query() query: Record<string, unknown>,
  ): Promise<ProductAttributeDefinitionListResponseDto> {
    const active = parseBoolean(query.active);

    return this.attributes.listDefinitions(active === undefined ? {} : { active });
  }

  @Post("attribute-definitions")
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiBody({ type: CreateProductAttributeDefinitionRequestDto })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiCreatedResponse({ type: CreateProductAttributeDefinitionResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  createDefinition(
    @Body() body: CreateProductAttributeDefinitionRequestDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<CreateProductAttributeDefinitionResponseDto> {
    if (!idempotencyKey) {
      throw new BadRequestException();
    }
    validateCreate(body);

    return this.attributes.createDefinition(body, idempotencyKey);
  }

  @Patch("attribute-definitions/:id")
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiParam({ format: "uuid", name: "id", type: String })
  @ApiBody({ type: UpdateProductAttributeDefinitionRequestDto })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiOkResponse({ type: UpdateProductAttributeDefinitionResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  updateDefinition(
    @Param("id") id: string,
    @Body() body: UpdateProductAttributeDefinitionRequestDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<UpdateProductAttributeDefinitionResponseDto> {
    if (!UUID_PATTERN.test(id) || !idempotencyKey) {
      throw new BadRequestException();
    }
    validateUpdate(body);

    return this.attributes.updateDefinition(id, body, idempotencyKey);
  }

  @Post("attribute-options")
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiBody({ type: CreateProductAttributeOptionRequestDto })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiCreatedResponse({ type: CreateProductAttributeOptionResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  createOption(
    @Body() body: CreateProductAttributeOptionRequestDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<CreateProductAttributeOptionResponseDto> {
    if (!idempotencyKey) {
      throw new BadRequestException();
    }
    validateCreate(body);
    if (typeof body.definitionId !== "string" || !UUID_PATTERN.test(body.definitionId)) {
      throw new BadRequestException();
    }

    return this.attributes.createOption(body, idempotencyKey);
  }

  @Patch("attribute-options/:id")
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiParam({ format: "uuid", name: "id", type: String })
  @ApiBody({ type: UpdateProductAttributeOptionRequestDto })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiOkResponse({ type: UpdateProductAttributeOptionResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  updateOption(
    @Param("id") id: string,
    @Body() body: UpdateProductAttributeOptionRequestDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<UpdateProductAttributeOptionResponseDto> {
    if (!UUID_PATTERN.test(id) || !idempotencyKey) {
      throw new BadRequestException();
    }
    validateUpdate(body);

    return this.attributes.updateOption(id, body, idempotencyKey);
  }
}
