import { createHash } from "node:crypto";

import { XMLParser, XMLValidator } from "fast-xml-parser";

const MAX_XML_BYTES = 5 * 1024 * 1024;
const ACCESS_KEY_PATTERN = /^\d{44}$/;
const DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/;

type XmlRecord = Record<string, unknown>;

export type NfeXmlItem = {
  cest?: string;
  cfop: string;
  commercialQuantity: string;
  commercialUnit: string;
  commercialUnitValue: string;
  description: string;
  gtin?: string;
  itemNumber: string;
  ncm: string;
  supplierCode: string;
  taxableQuantity: string;
  taxableUnit: string;
  taxableUnitValue: string;
  totalValue: string;
};

export type ParsedNfeXml = {
  accessKey: string;
  documentNumber: string;
  documentTotal: string;
  hashSha256: string;
  issuedAt: string;
  items: NfeXmlItem[];
  natureOfOperation: string;
  protocol?: string;
  recipientTaxId: string;
  schemaVersion: string;
  series: string;
  supplierName: string;
  supplierTaxId: string;
};

export type NfeXmlErrorCode =
  | "XML_DOCTYPE_NOT_ALLOWED"
  | "XML_INVALID"
  | "XML_TOO_LARGE"
  | "NFE_INVALID_DECIMAL"
  | "NFE_INVALID_STRUCTURE"
  | "NFE_MISSING_FIELD";

export class NfeXmlParseError extends Error {
  constructor(
    readonly code: NfeXmlErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "NfeXmlParseError";
  }
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  maxNestedTags: 100,
  parseAttributeValue: false,
  parseTagValue: false,
  processEntities: {
    enabled: true,
    maxEntityCount: 20,
    maxEntitySize: 1_000,
    maxExpandedLength: 20_000,
    maxExpansionDepth: 10,
    maxTotalExpansions: 1_000,
  },
  removeNSPrefix: true,
  trimValues: true,
});

function asRecord(value: unknown, path: string): XmlRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new NfeXmlParseError("NFE_INVALID_STRUCTURE", `Estrutura ausente em ${path}`);
  }

  return value as XmlRecord;
}

function optionalRecord(value: unknown): XmlRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as XmlRecord)
    : undefined;
}

function requiredString(record: XmlRecord, field: string, path: string): string {
  const value = record[field];

  if (typeof value !== "string" || value.length === 0) {
    throw new NfeXmlParseError("NFE_MISSING_FIELD", `Campo obrigatório ausente: ${path}.${field}`);
  }

  return value;
}

function optionalString(record: XmlRecord, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function taxId(record: XmlRecord, path: string): string {
  const value = optionalString(record, "CNPJ") ?? optionalString(record, "CPF");

  if (!value) {
    throw new NfeXmlParseError("NFE_MISSING_FIELD", `Identificador fiscal ausente: ${path}`);
  }

  return value;
}

function decimal(record: XmlRecord, field: string, path: string): string {
  const value = requiredString(record, field, path);

  if (!DECIMAL_PATTERN.test(value)) {
    throw new NfeXmlParseError("NFE_INVALID_DECIMAL", `Decimal inválido: ${path}.${field}`);
  }

  return value;
}

function parseItem(value: unknown, index: number): NfeXmlItem {
  const detail = asRecord(value, `NFe.infNFe.det[${index}]`);
  const product = asRecord(detail.prod, `NFe.infNFe.det[${index}].prod`);
  const path = `NFe.infNFe.det[${index}].prod`;

  const cest = optionalString(product, "CEST");
  const gtin = optionalString(product, "cEAN");

  return {
    ...(cest ? { cest } : {}),
    cfop: requiredString(product, "CFOP", path),
    commercialQuantity: decimal(product, "qCom", path),
    commercialUnit: requiredString(product, "uCom", path),
    commercialUnitValue: decimal(product, "vUnCom", path),
    description: requiredString(product, "xProd", path),
    ...(gtin ? { gtin } : {}),
    itemNumber: requiredString(detail, "@_nItem", `NFe.infNFe.det[${index}]`),
    ncm: requiredString(product, "NCM", path),
    supplierCode: requiredString(product, "cProd", path),
    taxableQuantity: decimal(product, "qTrib", path),
    taxableUnit: requiredString(product, "uTrib", path),
    taxableUnitValue: decimal(product, "vUnTrib", path),
    totalValue: decimal(product, "vProd", path),
  };
}

export function parseNfeXml(xml: string): ParsedNfeXml {
  if (Buffer.byteLength(xml, "utf8") > MAX_XML_BYTES) {
    throw new NfeXmlParseError("XML_TOO_LARGE", "XML excede o limite de 5 MiB");
  }

  if (/<!DOCTYPE/i.test(xml)) {
    throw new NfeXmlParseError("XML_DOCTYPE_NOT_ALLOWED", "DOCTYPE não é permitido");
  }

  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    throw new NfeXmlParseError("XML_INVALID", "XML malformado");
  }

  let parsed: unknown;
  try {
    parsed = xmlParser.parse(xml);
  } catch {
    throw new NfeXmlParseError("XML_INVALID", "XML não pôde ser processado");
  }

  const root = asRecord(parsed, "documento");
  const process = optionalRecord(root.nfeProc);
  const nfe = optionalRecord(process?.NFe) ?? optionalRecord(root.NFe);

  if (!nfe) {
    throw new NfeXmlParseError("NFE_INVALID_STRUCTURE", "Elemento NFe ausente");
  }

  const info = asRecord(nfe.infNFe, "NFe.infNFe");
  const identification = asRecord(info.ide, "NFe.infNFe.ide");
  const supplier = asRecord(info.emit, "NFe.infNFe.emit");
  const recipient = asRecord(info.dest, "NFe.infNFe.dest");
  const total = asRecord(info.total, "NFe.infNFe.total");
  const icmsTotal = asRecord(total.ICMSTot, "NFe.infNFe.total.ICMSTot");
  const details = Array.isArray(info.det) ? info.det : info.det === undefined ? [] : [info.det];
  const id = requiredString(info, "@_Id", "NFe.infNFe");
  const accessKey = id.startsWith("NFe") ? id.slice(3) : id;

  if (!ACCESS_KEY_PATTERN.test(accessKey)) {
    throw new NfeXmlParseError("NFE_INVALID_STRUCTURE", "Chave de acesso da NF-e inválida");
  }

  if (details.length === 0) {
    throw new NfeXmlParseError("NFE_INVALID_STRUCTURE", "NF-e não contém itens");
  }

  const protocolInfo = optionalRecord(optionalRecord(process?.protNFe)?.infProt);
  const protocol = protocolInfo ? optionalString(protocolInfo, "nProt") : undefined;

  return {
    accessKey,
    documentNumber: requiredString(identification, "nNF", "NFe.infNFe.ide"),
    documentTotal: decimal(icmsTotal, "vNF", "NFe.infNFe.total.ICMSTot"),
    hashSha256: createHash("sha256").update(xml, "utf8").digest("hex"),
    issuedAt:
      optionalString(identification, "dhEmi") ??
      requiredString(identification, "dEmi", "NFe.infNFe.ide"),
    items: details.map(parseItem),
    natureOfOperation: requiredString(identification, "natOp", "NFe.infNFe.ide"),
    ...(protocol ? { protocol } : {}),
    recipientTaxId: taxId(recipient, "NFe.infNFe.dest"),
    schemaVersion: requiredString(info, "@_versao", "NFe.infNFe"),
    series: requiredString(identification, "serie", "NFe.infNFe.ide"),
    supplierName: requiredString(supplier, "xNome", "NFe.infNFe.emit"),
    supplierTaxId: taxId(supplier, "NFe.infNFe.emit"),
  };
}
