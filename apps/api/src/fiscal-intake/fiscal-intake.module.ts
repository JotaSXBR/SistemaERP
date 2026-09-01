import { Module } from "@nestjs/common";

import { CatalogModule } from "../catalog/catalog.module.js";
import { FiscalIntakeService } from "./fiscal-intake.service.js";

@Module({
  exports: [FiscalIntakeService],
  imports: [CatalogModule],
  providers: [FiscalIntakeService],
})
export class FiscalIntakeModule {}
