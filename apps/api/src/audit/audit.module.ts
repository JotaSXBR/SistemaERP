import { Global, Module } from "@nestjs/common";

import { AuditService } from "./audit.service.js";
import { AuditController } from "./audit.controller.js";

@Global()
@Module({ controllers: [AuditController], exports: [AuditService], providers: [AuditService] })
export class AuditModule {}
