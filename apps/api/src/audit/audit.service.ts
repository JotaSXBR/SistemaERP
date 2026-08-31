import { Inject, Injectable } from "@nestjs/common";

import { DatabaseService } from "../database/database.service.js";
import { RequestContextService } from "../request-context/request-context.service.js";

export type AuditRecord = {
  action: string;
  entityId?: string;
  entityType: string;
  metadata?: Record<string, boolean | number | string | null>;
};

@Injectable()
export class AuditService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(RequestContextService) private readonly requestContext: RequestContextService,
  ) {}

  async record(event: AuditRecord): Promise<void> {
    const context = this.requestContext.getAuthenticated();

    await this.database.value.auditEvent.create({
      data: {
        action: event.action,
        actorUserId: context.userId,
        correlationId: context.correlationId,
        entityId: event.entityId ?? null,
        entityType: event.entityType,
        metadata: event.metadata ?? {},
        organizationId: context.organizationId,
        requestId: context.requestId,
      },
    });
  }
}
