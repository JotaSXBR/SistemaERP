import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
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

export class ProductDto {
  @ApiProperty({ type: Boolean })
  active!: boolean;

  @ApiProperty({ type: ProductPresentationDto })
  basePresentation!: ProductPresentationDto;

  @ApiProperty({ type: UnitOfMeasureDto })
  baseUnit!: UnitOfMeasureDto;

  @ApiProperty({ format: "uuid", type: String })
  id!: string;

  @ApiProperty({ type: String })
  shortDescription!: string;

  @ApiProperty({ type: String })
  sku!: string;

  @ApiPropertyOptional({ type: String })
  technicalDescription?: string;
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
  @ApiProperty({ type: CreateProductUnitRequestDto })
  baseUnit!: CreateProductUnitRequestDto;

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

  @ApiProperty({ type: UnitOfMeasureDto })
  baseUnit!: UnitOfMeasureDto;

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
