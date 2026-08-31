import { ApiProperty } from "@nestjs/swagger";

export class ApiErrorDetailsDto {
  [key: string]: unknown;
}

export class ApiErrorBodyDto {
  @ApiProperty({ example: "RESOURCE_NOT_FOUND" })
  code!: string;

  @ApiProperty({ example: "Recurso não encontrado" })
  message!: string;

  @ApiProperty({ additionalProperties: true, type: "object" })
  details!: ApiErrorDetailsDto;

  @ApiProperty({ example: "req_019..." })
  requestId!: string;
}

export class ApiErrorResponseDto {
  @ApiProperty({ type: ApiErrorBodyDto })
  error!: ApiErrorBodyDto;
}
