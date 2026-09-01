import { Module } from "@nestjs/common";

import { CatalogController } from "./catalog.controller.js";
import { CatalogService } from "./catalog.service.js";

@Module({
  controllers: [CatalogController],
  exports: [CatalogService],
  providers: [CatalogService],
})
export class CatalogModule {}
