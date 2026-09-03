import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ProductCategoryDto {
  @ApiProperty({ type: Boolean })
  active!: boolean;

  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ description: "Zero para as raízes da taxonomia", type: Number })
  depth!: number;

  @ApiProperty({ format: "uuid", type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiPropertyOptional({ format: "uuid", type: String })
  parentId?: string;

  @ApiProperty({
    description: "Nomes dos ancestrais e do próprio nó, da raiz para a folha",
    isArray: true,
    type: String,
  })
  path!: string[];
}

export class ProductCategoryListResponseDto {
  @ApiProperty({
    description: "Taxonomia inteira do tenant, ordenada da raiz para as folhas",
    isArray: true,
    type: ProductCategoryDto,
  })
  items!: ProductCategoryDto[];
}

export class CreateProductCategoryRequestDto {
  @ApiProperty({ maxLength: 40, type: String })
  code!: string;

  @ApiProperty({ maxLength: 120, type: String })
  name!: string;

  @ApiPropertyOptional({
    description: "Ausente cria uma raiz da taxonomia",
    format: "uuid",
    type: String,
  })
  parentId?: string;
}

export class CreateProductCategoryResponseDto {
  @ApiProperty({ type: ProductCategoryDto })
  category!: ProductCategoryDto;

  @ApiProperty({
    description: "Indica reaproveitamento seguro da resposta anterior",
    type: Boolean,
  })
  replayed!: boolean;
}

export class UpdateProductCategoryRequestDto {
  @ApiPropertyOptional({ type: Boolean })
  active?: boolean;

  @ApiPropertyOptional({ maxLength: 120, type: String })
  name?: string;
}

export class UpdateProductCategoryResponseDto {
  @ApiProperty({ type: ProductCategoryDto })
  category!: ProductCategoryDto;

  @ApiProperty({
    description: "Indica reaproveitamento seguro da resposta anterior",
    type: Boolean,
  })
  replayed!: boolean;
}

export class ProductBrandDto {
  @ApiProperty({ type: Boolean })
  active!: boolean;

  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ format: "uuid", type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;
}

export class ProductBrandListResponseDto {
  @ApiProperty({ isArray: true, type: ProductBrandDto })
  items!: ProductBrandDto[];

  @ApiProperty({ description: "Tamanho de página aplicado", type: Number })
  limit!: number;

  @ApiProperty({ description: "Deslocamento aplicado", type: Number })
  offset!: number;

  @ApiProperty({ description: "Total de marcas que atendem ao filtro", type: Number })
  total!: number;
}

export class CreateProductBrandRequestDto {
  @ApiProperty({ maxLength: 40, type: String })
  code!: string;

  @ApiProperty({ maxLength: 120, type: String })
  name!: string;
}

export class CreateProductBrandResponseDto {
  @ApiProperty({ type: ProductBrandDto })
  brand!: ProductBrandDto;

  @ApiProperty({
    description: "Indica reaproveitamento seguro da resposta anterior",
    type: Boolean,
  })
  replayed!: boolean;
}

export class UpdateProductBrandRequestDto {
  @ApiPropertyOptional({ type: Boolean })
  active?: boolean;

  @ApiPropertyOptional({ maxLength: 120, type: String })
  name?: string;
}

export class UpdateProductBrandResponseDto {
  @ApiProperty({ type: ProductBrandDto })
  brand!: ProductBrandDto;

  @ApiProperty({
    description: "Indica reaproveitamento seguro da resposta anterior",
    type: Boolean,
  })
  replayed!: boolean;
}
