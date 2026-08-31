import { ApiProperty } from "@nestjs/swagger";

export class ApiErrorDetailsDto {
  [key: string]: unknown;
}

export class ApiErrorBodyDto {
  @ApiProperty({ example: "RESOURCE_NOT_FOUND", type: String })
  code!: string;

  @ApiProperty({ example: "Recurso não encontrado", type: String })
  message!: string;

  @ApiProperty({ additionalProperties: true, type: "object" })
  details!: ApiErrorDetailsDto;

  @ApiProperty({ example: "req_019...", type: String })
  requestId!: string;
}

export class ApiErrorResponseDto {
  @ApiProperty({ type: () => ApiErrorBodyDto })
  error!: ApiErrorBodyDto;
}
