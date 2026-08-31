import { ApiProperty } from "@nestjs/swagger";

export class AuditEventDto {
  @ApiProperty({ type: String })
  action!: string;

  @ApiProperty({ format: "uuid", nullable: true, type: String })
  actorUserId!: string | null;

  @ApiProperty({ type: String })
  correlationId!: string;

  @ApiProperty({ nullable: true, type: String })
  entityId!: string | null;

  @ApiProperty({ type: String })
  entityType!: string;

  @ApiProperty({ format: "uuid", type: String })
  id!: string;

  @ApiProperty({ additionalProperties: true, type: "object" })
  metadata!: object;

  @ApiProperty({ format: "date-time", type: String })
  occurredAt!: string;

  @ApiProperty({ type: String })
  requestId!: string;
}
