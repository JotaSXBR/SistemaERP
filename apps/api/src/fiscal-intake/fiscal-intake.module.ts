import { Module } from "@nestjs/common";

import { CatalogModule } from "../catalog/catalog.module.js";
import { FiscalIntakeController } from "./fiscal-intake.controller.js";
import { FiscalIntakeService } from "./fiscal-intake.service.js";

@Module({
  controllers: [FiscalIntakeController],
  exports: [FiscalIntakeService],
  imports: [CatalogModule],
  providers: [FiscalIntakeService],
})
export class FiscalIntakeModule {}
