import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { FiscalDocumentStatus, FiscalDocumentValidationIssue } from "@sistema-erp/database";

import { MappedProductDto, ResolveSupplierProductResponseDto } from "../catalog/catalog.dto.js";

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

export class NfeValidationDto {
  @ApiProperty({ enum: FiscalDocumentValidationIssue, isArray: true })
  issues!: FiscalDocumentValidationIssue[];

  @ApiProperty({ enum: ["PASSED", "FAILED"] })
  status!: "FAILED" | "PASSED";
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

  @ApiProperty({ type: NfeValidationDto })
  validation!: NfeValidationDto;
}

export class NfeIntakeSupplierDto {
  @ApiProperty({ type: String })
  name!: string;

  @ApiPropertyOptional({ format: "uuid", type: String })
  partnerId?: string;

  @ApiProperty({
    enum: ["FOUND", "INACTIVE", "MISSING_SUPPLIER_ROLE", "NOT_FOUND"],
  })
  resolution!: "FOUND" | "INACTIVE" | "MISSING_SUPPLIER_ROLE" | "NOT_FOUND";

  @ApiProperty({ type: String })
  taxId!: string;
}

export class NfePersistentItemResolutionDto {
  @ApiPropertyOptional({ type: MappedProductDto })
  product?: MappedProductDto;

  @ApiProperty({ enum: ["MATCHED", "SUPPLIER_NOT_FOUND", "UNMAPPED"] })
  status!: "MATCHED" | "SUPPLIER_NOT_FOUND" | "UNMAPPED";
}

/**
 * Transcricao do grupo `imposto` do XML. Sao os valores declarados pelo emitente; este sistema nao
 * calcula tributo. Campos ausentes permanecem ausentes, nunca zero.
 */
export class NfeItemTaxDto {
  @ApiPropertyOptional({ description: "vTotTrib", type: String })
  approximateTaxValue?: string;
  @ApiPropertyOptional({ type: String })
  cbsValue?: string;
  @ApiPropertyOptional({ type: String })
  cofinsCst?: string;
  @ApiPropertyOptional({ type: String })
  cofinsValue?: string;
  @ApiPropertyOptional({ type: String })
  ibsCbsBase?: string;
  @ApiPropertyOptional({ description: "cClassTrib da NT 2025.002", type: String })
  ibsCbsClassification?: string;
  @ApiPropertyOptional({ description: "CST de IBS/CBS", type: String })
  ibsCbsCst?: string;
  @ApiPropertyOptional({ type: String })
  ibsValue?: string;
  @ApiPropertyOptional({ type: String })
  icmsBase?: string;
  @ApiPropertyOptional({ description: "pRedBC", type: String })
  icmsBaseReductionRate?: string;
  @ApiPropertyOptional({ description: "Codigo de Beneficio Fiscal (cBenef)", type: String })
  icmsBenefitCode?: string;
  @ApiPropertyOptional({ type: String })
  icmsCsosn?: string;
  @ApiPropertyOptional({ type: String })
  icmsCst?: string;
  @ApiPropertyOptional({ type: String })
  icmsRate?: string;
  @ApiPropertyOptional({ type: String })
  icmsStBase?: string;
  @ApiPropertyOptional({ type: String })
  icmsStValue?: string;
  @ApiPropertyOptional({ type: String })
  icmsValue?: string;
  @ApiPropertyOptional({ type: String })
  ipiCst?: string;
  @ApiPropertyOptional({ type: String })
  ipiRate?: string;
  @ApiPropertyOptional({ type: String })
  ipiValue?: string;
  @ApiPropertyOptional({ description: "Origem da mercadoria", type: String })
  origin?: string;
  @ApiPropertyOptional({ type: String })
  pisCst?: string;
  @ApiPropertyOptional({ type: String })
  pisValue?: string;
}

export class NfePersistentIntakeItemDto {
  @ApiPropertyOptional({ type: String })
  cest?: string;
  @ApiProperty({ type: String })
  cfop!: string;
  @ApiProperty({ type: String })
  commercialQuantity!: string;
  @ApiProperty({ type: String })
  commercialUnit!: string;
  @ApiProperty({ type: String })
  commercialUnitValue!: string;
  @ApiProperty({ type: String })
  description!: string;
  @ApiPropertyOptional({ type: String })
  gtin?: string;
  @ApiProperty({ format: "uuid", type: String })
  id!: string;
  @ApiProperty({ type: String })
  itemNumber!: string;
  @ApiProperty({ type: String })
  ncm!: string;
  @ApiProperty({ type: NfePersistentItemResolutionDto })
  resolution!: NfePersistentItemResolutionDto;
  @ApiProperty({ type: String })
  supplierCode!: string;
  @ApiPropertyOptional({ type: NfeItemTaxDto })
  tax?: NfeItemTaxDto;
  @ApiProperty({ type: String })
  taxableQuantity!: string;
  @ApiProperty({ type: String })
  taxableUnit!: string;
  @ApiProperty({ type: String })
  taxableUnitValue!: string;
  @ApiProperty({ type: String })
  totalValue!: string;
}

export class NfePersistentIntakeDto {
  @ApiProperty({ type: String })
  accessKey!: string;

  @ApiProperty({ format: "uuid", type: String })
  documentId!: string;

  @ApiProperty({ type: String })
  documentNumber!: string;

  @ApiProperty({ type: String })
  documentTotal!: string;

  @ApiProperty({ type: String })
  hashSha256!: string;

  @ApiProperty({ format: "uuid", type: String })
  ingestionId!: string;

  @ApiProperty({ type: String })
  issuedAt!: string;

  @ApiProperty({ isArray: true, type: NfePersistentIntakeItemDto })
  items!: NfePersistentIntakeItemDto[];

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

  @ApiProperty({ enum: FiscalDocumentStatus })
  status!: FiscalDocumentStatus;

  @ApiProperty({ type: NfeIntakePreviewSummaryDto })
  summary!: NfeIntakePreviewSummaryDto;

  @ApiProperty({ type: NfeIntakeSupplierDto })
  supplier!: NfeIntakeSupplierDto;

  @ApiProperty({ type: NfeValidationDto })
  validation!: NfeValidationDto;
}

export class CreateNfeIngestionResponseDto extends NfePersistentIntakeDto {
  @ApiProperty({ description: "Indica que o documento persistente já existia", type: Boolean })
  replayed!: boolean;
}

export class NfeInboxListItemDto {
  @ApiProperty({ type: String })
  accessKey!: string;

  @ApiProperty({ type: String })
  createdAt!: string;

  @ApiProperty({ format: "uuid", type: String })
  documentId!: string;

  @ApiProperty({ type: String })
  documentNumber!: string;

  @ApiProperty({ type: String })
  documentTotal!: string;

  @ApiProperty({ minimum: 0, type: Number })
  itemCount!: number;

  @ApiProperty({ type: String })
  issuedAt!: string;

  @ApiProperty({ enum: FiscalDocumentStatus })
  status!: FiscalDocumentStatus;

  @ApiProperty({ type: String })
  supplierName!: string;

  @ApiProperty({ type: String })
  supplierTaxId!: string;
}

export class NfeInboxListResponseDto {
  @ApiProperty({ isArray: true, type: NfeInboxListItemDto })
  items!: NfeInboxListItemDto[];

  @ApiProperty({ type: Number })
  limit!: number;

  @ApiProperty({ type: Number })
  offset!: number;

  @ApiProperty({ type: Number })
  total!: number;
}
