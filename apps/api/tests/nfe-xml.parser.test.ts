import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { NfeXmlParseError, parseNfeXml } from "../src/fiscal-intake/nfe-xml.parser.js";

const ACCESS_KEY = "1".repeat(44);
const SYNTHETIC_NFE_XML = readFileSync(
  new URL("./fixtures/nfe-synthetic.xml", import.meta.url),
  "utf8",
);

function syntheticNfeXml(items = syntheticItem()): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe${ACCESS_KEY}" versao="4.00">
      <ide>
        <natOp>COMPRA PARA COMERCIALIZACAO</natOp>
        <serie>1</serie>
        <nNF>42</nNF>
        <dhEmi>2026-08-31T10:30:00-03:00</dhEmi>
      </ide>
      <emit><CNPJ>11111111111111</CNPJ><xNome>FORNECEDOR SINTETICO</xNome></emit>
      <dest><CNPJ>22222222222222</CNPJ><xNome>DESTINATARIO SINTETICO</xNome></dest>
      ${items}
      <total><ICMSTot><vNF>1234.5600</vNF></ICMSTot></total>
    </infNFe>
  </NFe>
  <protNFe><infProt><nProt>000000000000000</nProt></infProt></protNFe>
</nfeProc>`;
}

function syntheticItem(itemNumber = "1", supplierCode = "000123"): string {
  return `<det nItem="${itemNumber}">
    <prod>
      <cProd>${supplierCode}</cProd>
      <cEAN>SEM GTIN</cEAN>
      <xProd>PERFIL METALICO SINTETICO</xProd>
      <NCM>00000000</NCM>
      <CFOP>1102</CFOP>
      <uCom>KG</uCom>
      <qCom>0.1000</qCom>
      <vUnCom>12345.6000000000</vUnCom>
      <vProd>1234.5600</vProd>
      <uTrib>KG</uTrib>
      <qTrib>0.1000</qTrib>
      <vUnTrib>12345.6000000000</vUnTrib>
    </prod>
  </det>`;
}

function expectParseError(xml: string, code: NfeXmlParseError["code"]): void {
  try {
    parseNfeXml(xml);
    throw new Error("Era esperado que o XML fosse rejeitado");
  } catch (error) {
    expect(error).toBeInstanceOf(NfeXmlParseError);
    expect((error as NfeXmlParseError).code).toBe(code);
  }
}

describe("parseNfeXml", () => {
  it("extrai a NF-e e preserva códigos e decimais como texto", () => {
    const parsed = parseNfeXml(SYNTHETIC_NFE_XML);

    expect(parsed).toMatchObject({
      accessKey: ACCESS_KEY,
      documentNumber: "42",
      documentTotal: "1234.5600",
      issuedAt: "2026-08-31T10:30:00-03:00",
      protocol: "000000000000000",
      recipientTaxId: "22222222222222",
      schemaVersion: "4.00",
      series: "1",
      supplierName: "FORNECEDOR SINTETICO",
      supplierTaxId: "11111111111111",
    });
    expect(parsed.hashSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(parsed.items[0]).toMatchObject({
      commercialQuantity: "0.1000",
      commercialUnitValue: "12345.6000000000",
      itemNumber: "1",
      supplierCode: "000123",
      totalValue: "1234.5600",
    });
    expect(typeof parsed.items[0]?.commercialQuantity).toBe("string");
  });

  it("normaliza um ou vários itens para uma lista", () => {
    const items = `${syntheticItem("1", "A-1")}${syntheticItem("2", "A-2")}`;

    expect(parseNfeXml(syntheticNfeXml()).items).toHaveLength(1);
    expect(
      parseNfeXml(syntheticNfeXml(items)).items.map(({ supplierCode }) => supplierCode),
    ).toEqual(["A-1", "A-2"]);
  });

  it("rejeita XML malformado sem expor seu conteúdo", () => {
    expectParseError("<NFe><infNFe></NFe>", "XML_INVALID");
  });

  it("rejeita DOCTYPE antes do parsing", () => {
    const xml = `<!DOCTYPE NFe [<!ENTITY example "unsafe">]>${syntheticNfeXml()}`;

    expectParseError(xml, "XML_DOCTYPE_NOT_ALLOWED");
  });

  it("rejeita documentos XML que não sejam NF-e", () => {
    expectParseError("<documento><item>teste</item></documento>", "NFE_INVALID_STRUCTURE");
  });
});
