import { BadRequestException, Body, Controller, Headers, Inject, Post } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { MembershipRole, PartnerRole, PartnerType } from "@sistema-erp/database";

import { Roles } from "../authorization/roles.decorator.js";
import { ApiErrorResponseDto } from "../errors/api-error.dto.js";
import { CreatePartnerRequestDto, CreatePartnerResponseDto } from "./partners.dto.js";
import { PartnersService } from "./partners.service.js";

const TAX_ID_PATTERN = /^[-A-Za-z0-9./\s]{11,32}$/;
const PARTNER_ROLES = new Set(Object.values(PartnerRole));

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

@ApiBearerAuth()
@ApiTags("partners")
@Controller("partners")
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
export class PartnersController {
  constructor(@Inject(PartnersService) private readonly partners: PartnersService) {}

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
}
