import { Inject, Injectable } from "@nestjs/common";

import type { ResolveSupplierProductResponseDto } from "../catalog/catalog.dto.js";
import { CatalogService } from "../catalog/catalog.service.js";
import { parseNfeXml, type NfeXmlItem, type ParsedNfeXml } from "./nfe-xml.parser.js";

export type NfeIntakePreviewItem = NfeXmlItem & {
  resolution: ResolveSupplierProductResponseDto;
};

export type NfeIntakePreview = Omit<ParsedNfeXml, "items"> & {
  items: NfeIntakePreviewItem[];
  summary: {
    matched: number;
    supplierNotFound: number;
    unmapped: number;
  };
};

export type SupplierProductResolver = Pick<CatalogService, "resolveSupplierProducts">;

@Injectable()
export class FiscalIntakeService {
  constructor(@Inject(CatalogService) private readonly catalog: SupplierProductResolver) {}

  async preview(xml: string): Promise<NfeIntakePreview> {
    const document = parseNfeXml(xml);
    const resolutions = await this.catalog.resolveSupplierProducts(
      document.supplierTaxId,
      document.items.map(({ supplierCode }) => supplierCode),
    );
    const summary = { matched: 0, supplierNotFound: 0, unmapped: 0 };
    const items = document.items.map((item, index) => {
      const resolution = resolutions[index];

      if (!resolution) {
        throw new Error("Supplier product resolution is incomplete");
      }

      if (resolution.status === "MATCHED") {
        summary.matched += 1;
      } else if (resolution.status === "SUPPLIER_NOT_FOUND") {
        summary.supplierNotFound += 1;
      } else {
        summary.unmapped += 1;
      }

      return {
        ...item,
        resolution:
          resolution.status === "MATCHED"
            ? { mapping: resolution.mapping, status: resolution.status }
            : { status: resolution.status },
      };
    });

    return { ...document, items, summary };
  }
}
