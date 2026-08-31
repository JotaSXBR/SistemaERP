import {
  BadRequestException,
  Body,
  Controller,
  Get,
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
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { ApiErrorResponseDto } from "../errors/api-error.dto.js";
import { RequestContextService } from "../request-context/request-context.service.js";
import { AuthService } from "./auth.service.js";
import {
  CreateSessionRequestDto,
  CreateSessionResponseDto,
  SessionIdentityDto,
} from "./auth.dto.js";
import { Public } from "./public.decorator.js";

function requireLoginInput(body: CreateSessionRequestDto): CreateSessionRequestDto {
  if (
    typeof body?.email !== "string" ||
    typeof body.organizationSlug !== "string" ||
    typeof body.password !== "string" ||
    !body.email.trim() ||
    !body.organizationSlug.trim() ||
    body.password.length < 8
  ) {
    throw new BadRequestException();
  }

  return body;
}

@ApiTags("identity")
@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(RequestContextService) private readonly requestContext: RequestContextService,
  ) {}

  @Public()
  @Post("sessions")
  @ApiBody({ type: CreateSessionRequestDto })
  @ApiCreatedResponse({ type: CreateSessionResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiTooManyRequestsResponse({ type: ApiErrorResponseDto })
  createSession(@Body() body: CreateSessionRequestDto): Promise<CreateSessionResponseDto> {
    return this.auth.createSession(requireLoginInput(body));
  }

  @Get("session")
  @ApiBearerAuth()
  @ApiOkResponse({ type: SessionIdentityDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  currentSession(): SessionIdentityDto {
    const context = this.requestContext.getAuthenticated();

    return {
      organizationId: context.organizationId,
      role: context.role,
      userId: context.userId,
    };
  }

  @Post("sessions/current/revoke")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async revokeSession(@Headers("authorization") authorization: string | undefined): Promise<void> {
    const token = authorization?.slice("Bearer ".length).trim();

    if (!token) {
      throw new BadRequestException();
    }

    await this.auth.revokeCurrentSession(token);
  }
}
