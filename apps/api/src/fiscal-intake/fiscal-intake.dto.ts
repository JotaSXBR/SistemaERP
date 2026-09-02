import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { ResolveSupplierProductResponseDto } from "../catalog/catalog.dto.js";

export class NfeIntakePreviewItemDto {
  @ApiPropertyOptional({ type: String })
  cest?: string;

  @ApiProperty({ type: String })
  cfop!: string;

  @ApiProperty({ description: "Decimal original serializado como texto", type: String })
  commercialQuantity!: string;

  @ApiProperty({ type: String })
  commercialUnit!: string;

  @ApiProperty({ description: "Decimal original serializado como texto", type: String })
  commercialUnitValue!: string;

  @ApiProperty({ type: String })
  description!: string;

  @ApiPropertyOptional({ type: String })
  gtin?: string;

  @ApiProperty({ type: String })
  itemNumber!: string;

  @ApiProperty({ type: String })
  ncm!: string;

  @ApiProperty({ type: ResolveSupplierProductResponseDto })
  resolution!: ResolveSupplierProductResponseDto;

  @ApiProperty({ type: String })
  supplierCode!: string;

  @ApiProperty({ description: "Decimal original serializado como texto", type: String })
  taxableQuantity!: string;

  @ApiProperty({ type: String })
  taxableUnit!: string;

  @ApiProperty({ description: "Decimal original serializado como texto", type: String })
  taxableUnitValue!: string;

  @ApiProperty({ description: "Decimal original serializado como texto", type: String })
  totalValue!: string;
}

export class NfeIntakePreviewSummaryDto {
  @ApiProperty({ minimum: 0, type: Number })
  matched!: number;

  @ApiProperty({ minimum: 0, type: Number })
  supplierNotFound!: number;

  @ApiProperty({ minimum: 0, type: Number })
  unmapped!: number;
}

export class NfeIntakePreviewDto {
  @ApiProperty({ type: String })
  accessKey!: string;

  @ApiProperty({ type: String })
  documentNumber!: string;

  @ApiProperty({ description: "Decimal original serializado como texto", type: String })
  documentTotal!: string;

  @ApiProperty({ description: "SHA-256 do conteúdo recebido", type: String })
  hashSha256!: string;

  @ApiProperty({ type: String })
  issuedAt!: string;

  @ApiProperty({ isArray: true, type: NfeIntakePreviewItemDto })
  items!: NfeIntakePreviewItemDto[];

  @ApiProperty({ type: String })
  natureOfOperation!: string;

  @ApiPropertyOptional({ type: String })
  protocol?: string;

  @ApiProperty({ type: String })
  recipientTaxId!: string;

  @ApiProperty({ type: String })
  schemaVersion!: string;

  @ApiProperty({ type: String })
  series!: string;

  @ApiProperty({ type: NfeIntakePreviewSummaryDto })
  summary!: NfeIntakePreviewSummaryDto;

  @ApiProperty({ type: String })
  supplierName!: string;

  @ApiProperty({ type: String })
  supplierTaxId!: string;
}
