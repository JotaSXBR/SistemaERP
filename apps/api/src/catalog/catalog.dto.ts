import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { ProductAttributeDto } from "./attributes.dto.js";
import { ProductConversionMode } from "@sistema-erp/database";

export class UnitOfMeasureDto {
  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ maximum: 10, minimum: 0, type: Number })
  decimalScale!: number;

  @ApiProperty({ format: "uuid", type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;
}

export class ProductPresentationDto {
  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ enum: ProductConversionMode })
  conversionMode!: ProductConversionMode;

  @ApiPropertyOptional({ description: "Decimal serializado como texto", type: String })
  conversionFactor?: string;

  @ApiProperty({ format: "uuid", type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: UnitOfMeasureDto })
  unit!: UnitOfMeasureDto;
}

export class ProductCategoryRefDto {
  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ format: "uuid", type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({
    description: "Nomes dos ancestrais e do próprio nó, da raiz para a folha",
    isArray: true,
    type: String,
  })
  path!: string[];
}

export class ProductBrandRefDto {
  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ format: "uuid", type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;
}

/**
 * Geometria do produto. Toda dimensão é milímetro e todo peso é quilograma — a unidade canônica da
 * ADR-0010. Os valores viajam como string decimal porque `number` em JSON é ponto flutuante, e
 * medida que entra em cálculo de preço não pode perder precisão no transporte. Campo ausente
 * significa "não se aplica a este produto", nunca zero.
 */
export class ProductGeometryDto {
  @ApiPropertyOptional({ description: "Altura em milímetros", type: String })
  heightMm?: string;

  @ApiPropertyOptional({ description: "Diâmetro interno em milímetros", type: String })
  innerDiameterMm?: string;

  @ApiPropertyOptional({ description: "Comprimento em milímetros", type: String })
  lengthMm?: string;

  @ApiPropertyOptional({ description: "Diâmetro externo em milímetros", type: String })
  outerDiameterMm?: string;

  @ApiPropertyOptional({ description: "Espessura em milímetros", type: String })
  thicknessMm?: string;

  @ApiPropertyOptional({ description: "Peso teórico por metro, em quilogramas", type: String })
  weightPerMeterKg?: string;

  @ApiPropertyOptional({
    description: "Peso teórico por metro quadrado, em quilogramas",
    type: String,
  })
  weightPerSquareMeterKg?: string;

  @ApiPropertyOptional({ description: "Largura em milímetros", type: String })
  widthMm?: string;
}

export class ProductDto {
  @ApiProperty({ type: Boolean })
  active!: boolean;

  @ApiProperty({
    description: "Facetas técnicas do produto, no máximo uma por eixo",
    isArray: true,
    type: ProductAttributeDto,
  })
  attributes!: ProductAttributeDto[];

  @ApiProperty({ type: ProductPresentationDto })
  basePresentation!: ProductPresentationDto;

  @ApiProperty({ type: UnitOfMeasureDto })
  baseUnit!: UnitOfMeasureDto;

  @ApiProperty({
    description: "Medidas do produto; medida ausente não se aplica ao produto",
    type: ProductGeometryDto,
  })
  geometry!: ProductGeometryDto;

  @ApiProperty({ format: "uuid", type: String })
  id!: string;

  @ApiProperty({ type: String })
  shortDescription!: string;

  @ApiProperty({ type: String })
  sku!: string;

  @ApiPropertyOptional({ type: String })
  technicalDescription?: string;
}

export class ProductAttributeAssignmentDto {
  @ApiProperty({ format: "uuid", type: String })
  definitionId!: string;

  @ApiProperty({ format: "uuid", type: String })
  optionId!: string;
}

/**
 * Atualização de geometria campo a campo: o que vier é gravado, `null` limpa a medida e o que
 * ficar de fora não muda. Difere das facetas de propósito — lá o array é o conjunto inteiro, aqui
 * cada medida é independente das outras e uma edição parcial é o caso comum.
 */
export class ProductGeometryUpdateDto {
  @ApiPropertyOptional({ nullable: true, type: String })
  heightMm?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  innerDiameterMm?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  lengthMm?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  outerDiameterMm?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  thicknessMm?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  weightPerMeterKg?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  weightPerSquareMeterKg?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  widthMm?: string | null;
}

export class CreateProductUnitRequestDto {
  @ApiProperty({ type: String })
  code!: string;

  @ApiPropertyOptional({ default: 4, maximum: 10, minimum: 0, type: Number })
  decimalScale?: number;

  @ApiProperty({ type: String })
  name!: string;
}

export class CreateProductRequestDto {
  @ApiPropertyOptional({
    description: "Facetas do produto já no cadastro, no máximo uma por eixo",
    isArray: true,
    type: ProductAttributeAssignmentDto,
  })
  attributes?: ProductAttributeAssignmentDto[];

  @ApiProperty({ type: CreateProductUnitRequestDto })
  baseUnit!: CreateProductUnitRequestDto;

  @ApiPropertyOptional({ format: "uuid", type: String })
  brandId?: string;

  @ApiPropertyOptional({ format: "uuid", type: String })
  categoryId?: string;

  @ApiPropertyOptional({
    description: "Medidas do produto já no cadastro; medida ausente não se aplica",
    type: ProductGeometryUpdateDto,
  })
  geometry?: ProductGeometryUpdateDto;

  @ApiProperty({ type: String })
  shortDescription!: string;

  @ApiProperty({ type: String })
  sku!: string;

  @ApiPropertyOptional({ type: String })
  technicalDescription?: string;
}

export class CreateProductResponseDto {
  @ApiProperty({ type: ProductDto })
  product!: ProductDto;

  @ApiProperty({
    description: "Indica reaproveitamento seguro da resposta anterior",
    type: Boolean,
  })
  replayed!: boolean;
}

export class CreateSupplierProductMappingRequestDto {
  @ApiProperty({ format: "uuid", type: String })
  productPresentationId!: string;

  @ApiProperty({ type: String })
  supplierCode!: string;

  @ApiProperty({ format: "uuid", type: String })
  supplierId!: string;
}

export class MappedProductDto {
  @ApiProperty({ type: String })
  presentationCode!: string;

  @ApiProperty({ format: "uuid", type: String })
  presentationId!: string;

  @ApiProperty({ type: String })
  presentationName!: string;

  @ApiProperty({ format: "uuid", type: String })
  productId!: string;

  @ApiProperty({ type: String })
  shortDescription!: string;

  @ApiProperty({ type: String })
  sku!: string;

  @ApiProperty({ type: UnitOfMeasureDto })
  unit!: UnitOfMeasureDto;
}

export class SupplierProductMappingDto {
  @ApiProperty({ type: Boolean })
  active!: boolean;

  @ApiProperty({ format: "uuid", type: String })
  id!: string;

  @ApiProperty({ type: MappedProductDto })
  product!: MappedProductDto;

  @ApiProperty({ type: String })
  supplierCode!: string;

  @ApiProperty({ format: "uuid", type: String })
  supplierId!: string;
}

export class CreateSupplierProductMappingResponseDto {
  @ApiProperty({ type: SupplierProductMappingDto })
  mapping!: SupplierProductMappingDto;

  @ApiProperty({
    description: "Indica reaproveitamento seguro da resposta anterior",
    type: Boolean,
  })
  replayed!: boolean;
}

export class ResolveSupplierProductRequestDto {
  @ApiProperty({ type: String })
  supplierCode!: string;

  @ApiProperty({ description: "CPF ou CNPJ do fornecedor lido do XML", type: String })
  supplierTaxId!: string;
}

export class ResolveSupplierProductResponseDto {
  @ApiPropertyOptional({ type: SupplierProductMappingDto })
  mapping?: SupplierProductMappingDto;

  @ApiProperty({ enum: ["MATCHED", "SUPPLIER_NOT_FOUND", "UNMAPPED"] })
  status!: "MATCHED" | "SUPPLIER_NOT_FOUND" | "UNMAPPED";
}

export class ProductListItemDto {
  @ApiProperty({ type: Boolean })
  active!: boolean;

  @ApiProperty({ type: UnitOfMeasureDto })
  baseUnit!: UnitOfMeasureDto;

  @ApiPropertyOptional({ type: ProductBrandRefDto })
  brand?: ProductBrandRefDto;

  @ApiPropertyOptional({ type: ProductCategoryRefDto })
  category?: ProductCategoryRefDto;

  @ApiProperty({ format: "uuid", type: String })
  id!: string;

  @ApiProperty({ type: String })
  shortDescription!: string;

  @ApiProperty({ type: String })
  sku!: string;
}

export class ProductListResponseDto {
  @ApiProperty({ isArray: true, type: ProductListItemDto })
  items!: ProductListItemDto[];

  @ApiProperty({ description: "Tamanho de página aplicado", type: Number })
  limit!: number;

  @ApiProperty({ description: "Deslocamento aplicado", type: Number })
  offset!: number;

  @ApiProperty({ description: "Total de produtos que atendem ao filtro", type: Number })
  total!: number;
}

export class ProductDetailDto {
  @ApiProperty({ type: Boolean })
  active!: boolean;

  @ApiProperty({
    description: "Facetas técnicas do produto, no máximo uma por eixo",
    isArray: true,
    type: ProductAttributeDto,
  })
  attributes!: ProductAttributeDto[];

  @ApiProperty({ type: UnitOfMeasureDto })
  baseUnit!: UnitOfMeasureDto;

  @ApiPropertyOptional({ type: ProductBrandRefDto })
  brand?: ProductBrandRefDto;

  @ApiPropertyOptional({ type: ProductCategoryRefDto })
  category?: ProductCategoryRefDto;

  @ApiProperty({
    description: "Medidas do produto; medida ausente não se aplica ao produto",
    type: ProductGeometryDto,
  })
  geometry!: ProductGeometryDto;

  @ApiProperty({ format: "uuid", type: String })
  id!: string;

  @ApiProperty({ isArray: true, type: ProductPresentationDto })
  presentations!: ProductPresentationDto[];

  @ApiProperty({ type: String })
  shortDescription!: string;

  @ApiProperty({ type: String })
  sku!: string;

  @ApiPropertyOptional({ type: String })
  technicalDescription?: string;
}

export class ProductDetailResponseDto {
  @ApiProperty({ type: ProductDetailDto })
  product!: ProductDetailDto;
}

export class UpdateProductRequestDto {
  @ApiPropertyOptional({ type: Boolean })
  active?: boolean;

  @ApiPropertyOptional({
    description:
      "Conjunto completo de facetas: substitui as atuais, e um array vazio remove todas. Ausente não altera.",
    isArray: true,
    type: ProductAttributeAssignmentDto,
  })
  attributes?: ProductAttributeAssignmentDto[];

  @ApiPropertyOptional({
    description: "Nulo remove a marca do produto",
    format: "uuid",
    nullable: true,
    type: String,
  })
  brandId?: string | null;

  @ApiPropertyOptional({
    description: "Nulo remove a categoria do produto",
    format: "uuid",
    nullable: true,
    type: String,
  })
  categoryId?: string | null;

  @ApiPropertyOptional({
    description: "Medidas informadas são gravadas, nulo limpa a medida e ausente não altera",
    type: ProductGeometryUpdateDto,
  })
  geometry?: ProductGeometryUpdateDto;

  @ApiPropertyOptional({ maxLength: 240, type: String })
  shortDescription?: string;

  @ApiPropertyOptional({
    description: "Texto vazio remove a descrição técnica",
    maxLength: 4000,
    type: String,
  })
  technicalDescription?: string;
}

export class UpdateProductResponseDto {
  @ApiProperty({ type: ProductDetailDto })
  product!: ProductDetailDto;

  @ApiProperty({
    description: "Indica reaproveitamento seguro da resposta anterior",
    type: Boolean,
  })
  replayed!: boolean;
}
