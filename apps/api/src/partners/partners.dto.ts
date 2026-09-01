import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PartnerRole, PartnerType } from "@sistema-erp/database";

export class PartnerDto {
  @ApiProperty({ type: Boolean })
  active!: boolean;

  @ApiProperty({ format: "uuid", type: String })
  id!: string;

  @ApiProperty({ type: String })
  legalName!: string;

  @ApiProperty({ enum: PartnerRole, isArray: true })
  roles!: PartnerRole[];

  @ApiProperty({ description: "CPF ou CNPJ normalizado", type: String })
  taxId!: string;

  @ApiPropertyOptional({ type: String })
  tradeName?: string;

  @ApiProperty({ enum: PartnerType })
  type!: PartnerType;
}

export class CreatePartnerRequestDto {
  @ApiProperty({ type: String })
  legalName!: string;

  @ApiProperty({ enum: PartnerRole, isArray: true })
  roles!: PartnerRole[];

  @ApiProperty({
    description: "CPF ou CNPJ; pontuação é removida antes da persistência",
    type: String,
  })
  taxId!: string;

  @ApiPropertyOptional({ type: String })
  tradeName?: string;

  @ApiProperty({ enum: PartnerType })
  type!: PartnerType;
}

export class CreatePartnerResponseDto {
  @ApiProperty({ type: PartnerDto })
  partner!: PartnerDto;

  @ApiProperty({
    description: "Indica reaproveitamento seguro da resposta anterior",
    type: Boolean,
  })
  replayed!: boolean;
}
