import { Module } from "@nestjs/common";

import { AuditModule } from "./audit/audit.module.js";
import { CatalogModule } from "./catalog/catalog.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { FiscalIntakeModule } from "./fiscal-intake/fiscal-intake.module.js";
import { HealthModule } from "./health/health.module.js";
import { IdempotencyModule } from "./idempotency/idempotency.module.js";
import { IdentityModule } from "./identity/identity.module.js";
import { OrganizationsModule } from "./organizations/organizations.module.js";
import { PartnersModule } from "./partners/partners.module.js";
import { RequestContextModule } from "./request-context/request-context.module.js";

@Module({
  imports: [
    RequestContextModule,
    DatabaseModule,
    AuditModule,
    IdempotencyModule,
    IdentityModule,
    OrganizationsModule,
    PartnersModule,
    CatalogModule,
    FiscalIntakeModule,
    HealthModule,
  ],
})
export class AppModule {}
