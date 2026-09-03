import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import {
  FiscalIntakeService,
  type SupplierProductResolver,
} from "../src/fiscal-intake/fiscal-intake.service.js";
import { NfeXmlParseError } from "../src/fiscal-intake/nfe-xml.parser.js";

const SYNTHETIC_NFE_XML = readFileSync(
  new URL("./fixtures/nfe-synthetic.xml", import.meta.url),
  "utf8",
);

describe("FiscalIntakeService", () => {
  it("preserves XML item data and reports unresolved supplier codes", async () => {
    const resolveSupplierProducts = vi.fn<SupplierProductResolver["resolveSupplierProducts"]>();
    resolveSupplierProducts.mockResolvedValue([{ status: "UNMAPPED", supplierCode: "000123" }]);
    const service = new FiscalIntakeService(
      {
        resolveSupplierDocument: vi.fn(),
        resolveSupplierProducts,
      },
      {
        value: {
          organization: {
            findUniqueOrThrow: vi.fn().mockResolvedValue({ fiscalTaxId: "22222222222222" }),
          },
        },
      } as never,
      undefined as never,
      { getAuthenticated: vi.fn().mockReturnValue({ organizationId: "organization-a" }) } as never,
    );

    const preview = await service.preview(SYNTHETIC_NFE_XML);

    expect(resolveSupplierProducts).toHaveBeenCalledOnce();
    expect(resolveSupplierProducts).toHaveBeenCalledWith("11111111111111", ["000123"]);
    expect(preview.items[0]).toMatchObject({
      commercialQuantity: "0.1000",
      description: "PERFIL METALICO SINTETICO",
      resolution: { status: "UNMAPPED" },
      supplierCode: "000123",
      totalValue: "1234.5600",
    });
    expect(preview.summary).toEqual({ matched: 0, supplierNotFound: 0, unmapped: 1 });
    expect(preview.validation).toEqual({ issues: [], status: "PASSED" });
  });

  it("reports a recipient mismatch against the authenticated organization", async () => {
    const service = new FiscalIntakeService(
      {
        resolveSupplierDocument: vi.fn(),
        resolveSupplierProducts: vi
          .fn()
          .mockResolvedValue([{ status: "UNMAPPED", supplierCode: "000123" }]),
      },
      {
        value: {
          organization: {
            findUniqueOrThrow: vi.fn().mockResolvedValue({ fiscalTaxId: "33333333333333" }),
          },
        },
      } as never,
      undefined as never,
      { getAuthenticated: vi.fn().mockReturnValue({ organizationId: "organization-a" }) } as never,
    );

    const preview = await service.preview(SYNTHETIC_NFE_XML);

    expect(preview.validation).toEqual({
      issues: ["RECIPIENT_TAX_ID_MISMATCH"],
      status: "FAILED",
    });
  });

  it("does not query the catalog when XML parsing fails", async () => {
    const resolveSupplierProducts = vi.fn<SupplierProductResolver["resolveSupplierProducts"]>();
    const service = new FiscalIntakeService(
      {
        resolveSupplierDocument: vi.fn(),
        resolveSupplierProducts,
      },
      undefined as never,
      undefined as never,
      undefined as never,
    );

    await expect(service.preview("<invalid>")).rejects.toBeInstanceOf(NfeXmlParseError);
    expect(resolveSupplierProducts).not.toHaveBeenCalled();
  });
});
