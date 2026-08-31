import { Module } from "@nestjs/common";

import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./health/health.module.js";
import { RequestContextModule } from "./request-context/request-context.module.js";

@Module({ imports: [RequestContextModule, DatabaseModule, HealthModule] })
export class AppModule {}
