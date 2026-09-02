import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { ApiErrorResponseDto } from "../errors/api-error.dto.js";
import { NfeIntakePreviewDto } from "./fiscal-intake.dto.js";
import { FiscalIntakeService } from "./fiscal-intake.service.js";
import { NfeXmlParseError } from "./nfe-xml.parser.js";

@ApiBearerAuth()
@ApiTags("fiscal-intake")
@Controller("fiscal-intake/nfe")
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
export class FiscalIntakeController {
  constructor(@Inject(FiscalIntakeService) private readonly fiscalIntake: FiscalIntakeService) {}

  @Post("previews")
  @HttpCode(HttpStatus.OK)
  @ApiConsumes("application/xml", "text/xml")
  @ApiBody({
    description: "Conteúdo original de uma NF-e 4.00, com limite de 5 MiB",
    schema: { type: "string" },
  })
  @ApiOkResponse({ type: NfeIntakePreviewDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiResponse({ status: 413, type: ApiErrorResponseDto })
  @ApiResponse({ status: 415, type: ApiErrorResponseDto })
  async preview(@Body() xml: unknown): Promise<NfeIntakePreviewDto> {
    if (typeof xml !== "string" || xml.length === 0) {
      throw new BadRequestException();
    }

    try {
      return await this.fiscalIntake.preview(xml);
    } catch (error) {
      if (error instanceof NfeXmlParseError) {
        throw new BadRequestException();
      }

      throw error;
    }
  }
}
