import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from "@nestjs/swagger";

import { DatabaseService } from "../database/database.service.js";
import { ApiErrorResponseDto } from "../errors/api-error.dto.js";
import { HealthResponseDto, ReadinessResponseDto } from "./health.dto.js";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Verifica se o processo da API está ativo" })
  @ApiOkResponse({ type: HealthResponseDto })
  liveness(): HealthResponseDto {
    return { status: "ok" };
  }

  @Get("ready")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Verifica se a API e suas dependências estão prontas" })
  @ApiOkResponse({ type: ReadinessResponseDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorResponseDto })
  async readiness(): Promise<ReadinessResponseDto> {
    try {
      await this.database.ping();
    } catch {
      throw new ServiceUnavailableException();
    }

    return { checks: { database: "up" }, status: "ok" };
  }
}
