import { ApiProperty } from "@nestjs/swagger";
import { MembershipRole, MembershipStatus } from "@sistema-erp/database";

export class OrganizationDto {
  @ApiProperty({ format: "uuid", type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  slug!: string;
}

export class MembershipDto {
  @ApiProperty({ type: String })
  email!: string;

  @ApiProperty({ format: "uuid", type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ enum: MembershipRole })
  role!: MembershipRole;

  @ApiProperty({ enum: MembershipStatus })
  status!: MembershipStatus;

  @ApiProperty({ format: "uuid", type: String })
  userId!: string;
}

export class AddMembershipRequestDto {
  @ApiProperty({ example: "member@example.test", type: String })
  email!: string;

  @ApiProperty({ enum: [MembershipRole.ADMIN, MembershipRole.MEMBER] })
  role!: MembershipRole;
}

export class AddMembershipResponseDto {
  @ApiProperty({ type: MembershipDto })
  membership!: MembershipDto;

  @ApiProperty({
    description: "Indica reaproveitamento seguro da resposta anterior",
    type: Boolean,
  })
  replayed!: boolean;
}
