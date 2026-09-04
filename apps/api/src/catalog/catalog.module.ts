import { Module } from "@nestjs/common";

import { AttributesController } from "./attributes.controller.js";
import { AttributesService } from "./attributes.service.js";
import { CatalogController } from "./catalog.controller.js";
import { CatalogService } from "./catalog.service.js";
import { ClassificationController } from "./classification.controller.js";
import { ClassificationService } from "./classification.service.js";

@Module({
  controllers: [AttributesController, CatalogController, ClassificationController],
  exports: [CatalogService],
  providers: [AttributesService, CatalogService, ClassificationService],
})
export class CatalogModule {}
