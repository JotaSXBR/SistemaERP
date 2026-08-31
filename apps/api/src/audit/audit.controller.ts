import { Controller, Get, Inject } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { MembershipRole } from "@sistema-erp/database";

import { Roles } from "../authorization/roles.decorator.js";
import { DatabaseService } from "../database/database.service.js";
import { ApiErrorResponseDto } from "../errors/api-error.dto.js";
import { RequestContextService } from "../request-context/request-context.service.js";
import { AuditEventDto } from "./audit.dto.js";

@ApiBearerAuth()
@ApiTags("audit")
@Controller("audit/events")
@Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
@ApiForbiddenResponse({ type: ApiErrorResponseDto })
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
export class AuditController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(RequestContextService) private readonly requestContext: RequestContextService,
  ) {}

  @Get()
  @ApiOkResponse({ type: AuditEventDto, isArray: true })
  async list(): Promise<AuditEventDto[]> {
    const { organizationId } = this.requestContext.getAuthenticated();
    const events = await this.database.value.auditEvent.findMany({
      orderBy: { occurredAt: "desc" },
      take: 100,
      where: { organizationId },
    });

    return events.map((event) => ({
      action: event.action,
      actorUserId: event.actorUserId,
      correlationId: event.correlationId,
      entityId: event.entityId,
      entityType: event.entityType,
      id: event.id,
      metadata: event.metadata as object,
      occurredAt: event.occurredAt.toISOString(),
      requestId: event.requestId,
    }));
  }
}
