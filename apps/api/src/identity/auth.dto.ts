import { ApiProperty } from "@nestjs/swagger";
import { MembershipRole } from "@sistema-erp/database";

export class CreateSessionRequestDto {
  @ApiProperty({ example: "admin@example.test", type: String })
  email!: string;

  @ApiProperty({ example: "demo", type: String })
  organizationSlug!: string;

  @ApiProperty({ format: "password", type: String })
  password!: string;
}

export class SessionIdentityDto {
  @ApiProperty({ format: "uuid", type: String })
  organizationId!: string;

  @ApiProperty({ enum: MembershipRole })
  role!: MembershipRole;

  @ApiProperty({ format: "uuid", type: String })
  userId!: string;
}

export class CreateSessionResponseDto extends SessionIdentityDto {
  @ApiProperty({ format: "date-time", type: String })
  expiresAt!: string;

  @ApiProperty({ description: "Token opaco retornado somente na criação da sessão", type: String })
  token!: string;
}
