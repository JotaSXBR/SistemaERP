import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { NfeXmlParseError, parseNfeXml } from "../src/fiscal-intake/nfe-xml.parser.js";

const ACCESS_KEY = "1".repeat(44);
const REFORM_NFE_XML = readFileSync(
  new URL("./fixtures/nfe-synthetic-reforma.xml", import.meta.url),
  "utf8",
);

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

  it("transcreve o grupo imposto do regime atual sem calcular nada", () => {
    const [item] = parseNfeXml(SYNTHETIC_NFE_XML).items;

    expect(item?.tax).toMatchObject({
      approximateTaxValue: "111.1100",
      cofinsCst: "01",
      cofinsValue: "93.8300",
      icmsBase: "823.0400",
      icmsBaseReductionRate: "33.3300",
      icmsBenefitCode: "SP000001",
      icmsCst: "20",
      icmsRate: "12.0000",
      icmsValue: "98.7600",
      ipiCst: "50",
      ipiRate: "5.0000",
      ipiValue: "61.7300",
      origin: "0",
      pisCst: "01",
      pisValue: "20.3700",
    });
    // Sem grupo IBSCBS, os campos da reforma permanecem ausentes em vez de zerados.
    expect(item?.tax.ibsCbsCst).toBeUndefined();
    expect(item?.tax.cbsValue).toBeUndefined();
    expect(item?.tax.icmsCsosn).toBeUndefined();
  });

  it("transcreve o grupo IBSCBS da NT 2025.002 quando presente", () => {
    const [item] = parseNfeXml(REFORM_NFE_XML).items;

    expect(item?.tax).toMatchObject({
      cbsValue: "11.1100",
      ibsCbsBase: "1234.5600",
      ibsCbsClassification: "000001",
      ibsCbsCst: "000",
      ibsValue: "1.2400",
    });
    // Os dois regimes coexistem na transição: o ICMS continua declarado no mesmo item.
    expect(item?.tax.icmsCst).toBe("20");
  });

  it("aceita item sem grupo imposto e não inventa valores", () => {
    const xml = SYNTHETIC_NFE_XML.replace(/<imposto>[\s\S]*?<\/imposto>/, "");
    const [item] = parseNfeXml(xml).items;

    expect(item?.tax).toEqual({});
  });

  it("lê CSOSN em vez de CST quando o emitente é do Simples Nacional", () => {
    const xml = SYNTHETIC_NFE_XML.replace(
      /<ICMS20>[\s\S]*?<\/ICMS20>/,
      "<ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102>",
    );
    const [item] = parseNfeXml(xml).items;

    expect(item?.tax.icmsCsosn).toBe("102");
    expect(item?.tax.icmsCst).toBeUndefined();
    expect(item?.tax.origin).toBe("0");
  });

  it("rejeita decimal inválido dentro do grupo imposto", () => {
    const xml = SYNTHETIC_NFE_XML.replace("<vICMS>98.7600</vICMS>", "<vICMS>abc</vICMS>");

    expectParseError(xml, "NFE_INVALID_DECIMAL");
  });

  it("rejeita documentos XML que não sejam NF-e", () => {
    expectParseError("<documento><item>teste</item></documento>", "NFE_INVALID_STRUCTURE");
  });
});
