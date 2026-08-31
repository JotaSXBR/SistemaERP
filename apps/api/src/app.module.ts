import { Module } from "@nestjs/common";

import { AuditModule } from "./audit/audit.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./health/health.module.js";
import { IdempotencyModule } from "./idempotency/idempotency.module.js";
import { IdentityModule } from "./identity/identity.module.js";
import { OrganizationsModule } from "./organizations/organizations.module.js";
import { RequestContextModule } from "./request-context/request-context.module.js";

@Module({
  imports: [
    RequestContextModule,
    DatabaseModule,
    AuditModule,
    IdempotencyModule,
    IdentityModule,
    OrganizationsModule,
    HealthModule,
  ],
})
export class AppModule {}
