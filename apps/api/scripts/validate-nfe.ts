import { opendir, readFile, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";

import { NfeXmlParseError, parseNfeXml } from "../src/fiscal-intake/nfe-xml.parser.js";

const inputPath = process.argv.slice(2).find((argument) => argument !== "--");

async function findXmlFiles(path: string): Promise<string[]> {
  const input = await stat(path);
  if (input.isFile()) {
    return extname(path).toLowerCase() === ".xml" ? [path] : [];
  }

  if (!input.isDirectory()) {
    return [];
  }

  const files: string[] = [];
  const directory = await opendir(path);

  for await (const entry of directory) {
    const entryPath = resolve(path, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findXmlFiles(entryPath)));
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === ".xml") {
      files.push(entryPath);
    }
  }

  return files.sort();
}

async function validateFiles(paths: string[]): Promise<void> {
  const commercialUnits = new Set<string>();
  const supplierCodes = new Map<string, Set<string>>();
  const supplierItems = new Map<
    string,
    { commercialUnits: Set<string>; descriptions: Set<string>; ncms: Set<string> }
  >();
  const suppliers = new Set<string>();
  const taxableUnits = new Set<string>();
  const schemaVersions = new Set<string>();
  const rejections: Record<string, number> = {};
  let itemCount = 0;
  let itemsWithUsableGtin = 0;
  let parsedFileCount = 0;

  for (const path of paths) {
    try {
      const nfe = parseNfeXml(await readFile(path, "utf8"));
      parsedFileCount += 1;
      itemCount += nfe.items.length;
      suppliers.add(nfe.supplierTaxId);
      schemaVersions.add(nfe.schemaVersion);
      nfe.items.forEach(({ commercialUnit, description, gtin, ncm, supplierCode, taxableUnit }) => {
        commercialUnits.add(commercialUnit);
        taxableUnits.add(taxableUnit);
        if (gtin && /^\d{8,14}$/.test(gtin) && !/^0+$/.test(gtin)) {
          itemsWithUsableGtin += 1;
        }

        const mappingKey = `${nfe.supplierTaxId}\u0000${supplierCode}`;
        const evidence = supplierItems.get(mappingKey) ?? {
          commercialUnits: new Set<string>(),
          descriptions: new Set<string>(),
          ncms: new Set<string>(),
        };
        evidence.commercialUnits.add(commercialUnit);
        evidence.descriptions.add(description);
        evidence.ncms.add(ncm);
        supplierItems.set(mappingKey, evidence);

        const codeSuppliers = supplierCodes.get(supplierCode) ?? new Set<string>();
        codeSuppliers.add(nfe.supplierTaxId);
        supplierCodes.set(supplierCode, codeSuppliers);
      });
    } catch (error) {
      const code = error instanceof NfeXmlParseError ? error.code : "FILE_READ_ERROR";
      rejections[code] = (rejections[code] ?? 0) + 1;
    }
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        commercialUnits: [...commercialUnits].sort(),
        fileCount: paths.length,
        itemCount,
        itemsWithUsableGtin,
        mappingsWithCommercialUnitVariation: [...supplierItems.values()].filter(
          ({ commercialUnits: units }) => units.size > 1,
        ).length,
        mappingsWithDescriptionVariation: [...supplierItems.values()].filter(
          ({ descriptions }) => descriptions.size > 1,
        ).length,
        mappingsWithNcmVariation: [...supplierItems.values()].filter(({ ncms }) => ncms.size > 1)
          .length,
        parsedFileCount,
        rejectedFileCount: paths.length - parsedFileCount,
        rejections,
        repeatedSupplierItemOccurrences: itemCount - supplierItems.size,
        schemaVersions: [...schemaVersions].sort(),
        supplierCodesSharedAcrossSuppliers: [...supplierCodes.values()].filter(
          (codeSuppliers) => codeSuppliers.size > 1,
        ).length,
        supplierCount: suppliers.size,
        taxableUnits: [...taxableUnits].sort(),
        uniqueSupplierItemCount: supplierItems.size,
      },
      null,
      2,
    )}\n`,
  );

  if (parsedFileCount !== paths.length) {
    process.exitCode = 1;
  }
}

if (!inputPath) {
  process.stderr.write("Uso: pnpm nfe:validate -- <caminho-do-xml>\n");
  process.exitCode = 2;
} else {
  try {
    const files = await findXmlFiles(resolve(process.env.INIT_CWD ?? process.cwd(), inputPath));
    if (files.length === 0) {
      process.stderr.write("NF-e rejeitada: XML_FILE_NOT_FOUND\n");
      process.exitCode = 1;
    } else {
      await validateFiles(files);
    }
  } catch (error) {
    const code = error instanceof NfeXmlParseError ? error.code : "FILE_READ_ERROR";
    process.stderr.write(`NF-e rejeitada: ${code}\n`);
    process.exitCode = 1;
  }
}
