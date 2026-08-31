import { ApiProperty } from "@nestjs/swagger";

export class HealthResponseDto {
  @ApiProperty({ enum: ["ok"], example: "ok" })
  status!: "ok";
}

export class ReadinessChecksDto {
  @ApiProperty({ enum: ["up"], example: "up" })
  database!: "up";
}

export class ReadinessResponseDto extends HealthResponseDto {
  @ApiProperty({ type: ReadinessChecksDto })
  checks!: ReadinessChecksDto;
}
