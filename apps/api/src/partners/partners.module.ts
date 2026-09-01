import { Module } from "@nestjs/common";

import { PartnersController } from "./partners.controller.js";
import { PartnersService } from "./partners.service.js";

@Module({
  controllers: [PartnersController],
  exports: [PartnersService],
  providers: [PartnersService],
})
export class PartnersModule {}
