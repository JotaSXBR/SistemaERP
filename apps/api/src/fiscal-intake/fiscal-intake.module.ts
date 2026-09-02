import { Module } from "@nestjs/common";

import { CatalogModule } from "../catalog/catalog.module.js";
import { FiscalIntakeController } from "./fiscal-intake.controller.js";
import { FiscalIntakeService } from "./fiscal-intake.service.js";
import {
  createRuntimeObjectStorage,
  OBJECT_STORAGE,
} from "./infrastructure/runtime-object-storage.js";

@Module({
  controllers: [FiscalIntakeController],
  exports: [FiscalIntakeService],
  imports: [CatalogModule],
  providers: [
    FiscalIntakeService,
    { provide: OBJECT_STORAGE, useFactory: () => createRuntimeObjectStorage() },
  ],
})
export class FiscalIntakeModule {}
