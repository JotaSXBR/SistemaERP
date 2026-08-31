import { BadRequestException, Body, Controller, Get, Headers, Inject, Post } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { MembershipRole } from "@sistema-erp/database";

import { Roles } from "../authorization/roles.decorator.js";
import { ApiErrorResponseDto } from "../errors/api-error.dto.js";
import {
  AddMembershipRequestDto,
  AddMembershipResponseDto,
  MembershipDto,
  OrganizationDto,
} from "./organizations.dto.js";
import { OrganizationsService } from "./organizations.service.js";

function validateMembershipInput(body: AddMembershipRequestDto): AddMembershipRequestDto {
  const candidate = body as AddMembershipRequestDto & { organizationId?: unknown };

  if (
    candidate.organizationId !== undefined ||
    typeof body?.email !== "string" ||
    !body.email.includes("@") ||
    (body.role !== MembershipRole.ADMIN && body.role !== MembershipRole.MEMBER)
  ) {
    throw new BadRequestException();
  }

  return body;
}

@ApiBearerAuth()
@ApiTags("organizations")
@Controller("organizations/current")
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
export class OrganizationsController {
  constructor(@Inject(OrganizationsService) private readonly organizations: OrganizationsService) {}

  @Get()
  @ApiOkResponse({ type: OrganizationDto })
  getCurrent(): Promise<OrganizationDto> {
    return this.organizations.getCurrent();
  }

  @Get("memberships")
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiOkResponse({ type: MembershipDto, isArray: true })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  listMemberships(): Promise<MembershipDto[]> {
    return this.organizations.listMemberships();
  }

  @Post("memberships")
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiBody({ type: AddMembershipRequestDto })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiCreatedResponse({ type: AddMembershipResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  addMembership(
    @Body() body: AddMembershipRequestDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<AddMembershipResponseDto> {
    if (!idempotencyKey) {
      throw new BadRequestException();
    }

    return this.organizations.addMembership(validateMembershipInput(body), idempotencyKey);
  }
}
