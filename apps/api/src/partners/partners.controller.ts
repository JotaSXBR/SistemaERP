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
import { MembershipRole, PartnerRole, PartnerType } from "@sistema-erp/database";

import { Roles } from "../authorization/roles.decorator.js";
import { ApiErrorResponseDto } from "../errors/api-error.dto.js";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  MAX_SEARCH_LENGTH,
  parseBoolean,
  parseEnum,
  parsePageRequest,
  parseSearch,
} from "../pagination/pagination.js";
import {
  CreatePartnerRequestDto,
  CreatePartnerResponseDto,
  PartnerListResponseDto,
  PartnerResponseDto,
  UpdatePartnerRequestDto,
  UpdatePartnerResponseDto,
} from "./partners.dto.js";
import { PartnersService } from "./partners.service.js";

const TAX_ID_PATTERN = /^[-A-Za-z0-9./\s]{11,32}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PARTNER_ROLE_VALUES = Object.values(PartnerRole);
const PARTNER_ROLES = new Set(PARTNER_ROLE_VALUES);

function validateInput(body: CreatePartnerRequestDto): CreatePartnerRequestDto {
  const candidate = body as CreatePartnerRequestDto & { organizationId?: unknown };

  if (
    candidate.organizationId !== undefined ||
    typeof body?.legalName !== "string" ||
    body.legalName.trim().length === 0 ||
    body.legalName.trim().length > 160 ||
    typeof body.taxId !== "string" ||
    !TAX_ID_PATTERN.test(body.taxId) ||
    (body.type !== PartnerType.ORGANIZATION && body.type !== PartnerType.PERSON) ||
    !Array.isArray(body.roles) ||
    body.roles.length === 0 ||
    body.roles.some((role) => !PARTNER_ROLES.has(role)) ||
    (body.tradeName !== undefined &&
      (typeof body.tradeName !== "string" || body.tradeName.trim().length > 160))
  ) {
    throw new BadRequestException();
  }

  return body;
}

function validateUpdate(body: UpdatePartnerRequestDto): UpdatePartnerRequestDto {
  const candidate = body as UpdatePartnerRequestDto & { organizationId?: unknown };

  if (
    candidate.organizationId !== undefined ||
    (body.active === undefined && body.roles === undefined) ||
    (body.active !== undefined && typeof body.active !== "boolean") ||
    (body.roles !== undefined &&
      (!Array.isArray(body.roles) ||
        body.roles.length === 0 ||
        body.roles.some((role) => !PARTNER_ROLES.has(role))))
  ) {
    throw new BadRequestException();
  }

  return body;
}

@ApiBearerAuth()
@ApiTags("partners")
@Controller("partners")
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
export class PartnersController {
  constructor(@Inject(PartnersService) private readonly partners: PartnersService) {}

  @Get()
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
  @ApiQuery({ name: "role", enum: PartnerRole, required: false })
  @ApiQuery({
    description: "Trecho da razão social, nome fantasia ou identificador fiscal",
    name: "search",
    required: false,
    schema: { maxLength: MAX_SEARCH_LENGTH, type: "string" },
  })
  @ApiOkResponse({ type: PartnerListResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  list(@Query() query: Record<string, unknown>): Promise<PartnerListResponseDto> {
    const page = parsePageRequest(query);
    const active = parseBoolean(query.active);
    const role = parseEnum(query.role, PARTNER_ROLE_VALUES);
    const search = parseSearch(query.search);

    return this.partners.list({
      ...page,
      ...(active === undefined ? {} : { active }),
      ...(role ? { role } : {}),
      ...(search ? { search } : {}),
    });
  }

  @Get(":id")
  @ApiParam({ format: "uuid", name: "id", type: String })
  @ApiOkResponse({ type: PartnerResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  async findById(@Param("id") id: string): Promise<PartnerResponseDto> {
    if (!UUID_PATTERN.test(id)) {
      throw new BadRequestException();
    }

    return { partner: await this.partners.findById(id) };
  }

  @Post()
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiBody({ type: CreatePartnerRequestDto })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiCreatedResponse({ type: CreatePartnerResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  create(
    @Body() body: CreatePartnerRequestDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<CreatePartnerResponseDto> {
    if (!idempotencyKey) {
      throw new BadRequestException();
    }

    return this.partners.create(validateInput(body), idempotencyKey);
  }

  @Patch(":id")
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiParam({ format: "uuid", name: "id", type: String })
  @ApiBody({ type: UpdatePartnerRequestDto })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiOkResponse({ type: UpdatePartnerResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  update(
    @Param("id") id: string,
    @Body() body: UpdatePartnerRequestDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<UpdatePartnerResponseDto> {
    if (!UUID_PATTERN.test(id) || !idempotencyKey) {
      throw new BadRequestException();
    }

    return this.partners.update(id, validateUpdate(body), idempotencyKey);
  }
}
