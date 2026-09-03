import { Module } from "@nestjs/common";

import { CatalogController } from "./catalog.controller.js";
import { CatalogService } from "./catalog.service.js";
import { ClassificationController } from "./classification.controller.js";
import { ClassificationService } from "./classification.service.js";

@Module({
  controllers: [CatalogController, ClassificationController],
  exports: [CatalogService],
  providers: [CatalogService, ClassificationService],
})
export class CatalogModule {}
