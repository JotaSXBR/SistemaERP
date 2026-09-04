import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ProductAttributeOptionDto {
  @ApiProperty({ type: Boolean })
  active!: boolean;

  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ format: "uuid", type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;
}

export class ProductAttributeDefinitionDto {
  @ApiProperty({ type: Boolean })
  active!: boolean;

  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ format: "uuid", type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({
    description: "Valores permitidos deste eixo, ordenados por nome",
    isArray: true,
    type: ProductAttributeOptionDto,
  })
  options!: ProductAttributeOptionDto[];
}

export class ProductAttributeDefinitionListResponseDto {
  @ApiProperty({
    description: "Eixos de classificação do tenant, com seus valores",
    isArray: true,
    type: ProductAttributeDefinitionDto,
  })
  items!: ProductAttributeDefinitionDto[];
}

export class CreateProductAttributeDefinitionRequestDto {
  @ApiProperty({ maxLength: 40, type: String })
  code!: string;

  @ApiProperty({ maxLength: 120, type: String })
  name!: string;
}

export class CreateProductAttributeDefinitionResponseDto {
  @ApiProperty({ type: ProductAttributeDefinitionDto })
  definition!: ProductAttributeDefinitionDto;

  @ApiProperty({
    description: "Indica reaproveitamento seguro da resposta anterior",
    type: Boolean,
  })
  replayed!: boolean;
}

export class UpdateProductAttributeDefinitionRequestDto {
  @ApiPropertyOptional({ type: Boolean })
  active?: boolean;

  @ApiPropertyOptional({ maxLength: 120, type: String })
  name?: string;
}

export class UpdateProductAttributeDefinitionResponseDto {
  @ApiProperty({ type: ProductAttributeDefinitionDto })
  definition!: ProductAttributeDefinitionDto;

  @ApiProperty({
    description: "Indica reaproveitamento seguro da resposta anterior",
    type: Boolean,
  })
  replayed!: boolean;
}

export class CreateProductAttributeOptionRequestDto {
  @ApiProperty({ maxLength: 40, type: String })
  code!: string;

  @ApiProperty({ format: "uuid", type: String })
  definitionId!: string;

  @ApiProperty({ maxLength: 120, type: String })
  name!: string;
}

export class CreateProductAttributeOptionResponseDto {
  @ApiProperty({ type: ProductAttributeOptionDto })
  option!: ProductAttributeOptionDto;

  @ApiProperty({
    description: "Indica reaproveitamento seguro da resposta anterior",
    type: Boolean,
  })
  replayed!: boolean;
}

export class UpdateProductAttributeOptionRequestDto {
  @ApiPropertyOptional({ type: Boolean })
  active?: boolean;

  @ApiPropertyOptional({ maxLength: 120, type: String })
  name?: string;
}

export class UpdateProductAttributeOptionResponseDto {
  @ApiProperty({ type: ProductAttributeOptionDto })
  option!: ProductAttributeOptionDto;

  @ApiProperty({
    description: "Indica reaproveitamento seguro da resposta anterior",
    type: Boolean,
  })
  replayed!: boolean;
}

/** Faceta de um produto: o eixo e o valor escolhido nele. */
export class ProductAttributeDto {
  @ApiProperty({ format: "uuid", type: String })
  definitionId!: string;

  @ApiProperty({ type: String })
  definitionCode!: string;

  @ApiProperty({ type: String })
  definitionName!: string;

  @ApiProperty({ format: "uuid", type: String })
  optionId!: string;

  @ApiProperty({ type: String })
  optionCode!: string;

  @ApiProperty({ type: String })
  optionName!: string;
}
