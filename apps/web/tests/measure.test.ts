import { describe, expect, it } from "vitest";

import {
  formatInches,
  formatMeasure,
  isMeasureInput,
  parseMeasureInput,
} from "../src/features/registry/measure.js";

/** A tabela de referência oficial de `docs/product/inch-display-spec.md`, na íntegra. */
const OFFICIAL_TABLE: [string, string][] = [
  ["0,79", '1/32"'],
  ["1,59", '1/16"'],
  ["2,38", '3/32"'],
  ["3,18", '1/8"'],
  ["3,97", '5/32"'],
  ["4,76", '3/16"'],
  ["5,56", '7/32"'],
  ["6,35", '1/4"'],
  ["7,14", '9/32"'],
  ["7,94", '5/16"'],
  ["8,73", '11/32"'],
  ["9,53", '3/8"'],
  ["10,32", '13/32"'],
  ["11,11", '7/16"'],
  ["11,91", '15/32"'],
  ["12,7", '1/2"'],
  ["13,49", '17/32"'],
  ["14,29", '9/16"'],
  ["15,08", '19/32"'],
  ["15,88", '5/8"'],
  ["16,67", '21/32"'],
  ["17,46", '11/16"'],
  ["18,26", '23/32"'],
  ["19,05", '3/4"'],
  ["19,84", '25/32"'],
  ["20,64", '13/16"'],
  ["21,43", '27/32"'],
  ["22,23", '7/8"'],
  ["23,02", '29/32"'],
  ["23,81", '15/16"'],
  ["24,61", '31/32"'],
  ["25,4", '1"'],
];

describe("parseMeasureInput", () => {
  it("accepts the comma the user types and hands the API a dot", () => {
    expect(parseMeasureInput("3,18")).toBe("3.18");
    expect(parseMeasureInput("3.18")).toBe("3.18");
    expect(parseMeasureInput(" 1200 ")).toBe("1200");
  });

  it("refuses zero, because a blank field is how a measurement stops applying", () => {
    expect(parseMeasureInput("0")).toBeUndefined();
    expect(parseMeasureInput("0,00")).toBeUndefined();
  });

  it("refuses what is not a plain positive decimal", () => {
    expect(parseMeasureInput("-3")).toBeUndefined();
    expect(parseMeasureInput('3,18"')).toBeUndefined();
    expect(parseMeasureInput("3e2")).toBeUndefined();
    expect(parseMeasureInput("")).toBeUndefined();
  });
});

describe("isMeasureInput", () => {
  it("treats a blank field as valid, since not every product has every measurement", () => {
    expect(isMeasureInput("")).toBe(true);
    expect(isMeasureInput("   ")).toBe(true);
    expect(isMeasureInput(undefined)).toBe(true);
  });

  it("rejects a filled field that is not a positive number", () => {
    expect(isMeasureInput("0")).toBe(false);
    expect(isMeasureInput("abc")).toBe(false);
    expect(isMeasureInput("3,18")).toBe(true);
  });
});

describe("formatInches", () => {
  it.each(OFFICIAL_TABLE)("shows %s mm as %s", (millimeters, expected) => {
    expect(formatInches(millimeters)).toBe(expected);
  });

  it("picks the nearest fraction, never a decimal inch", () => {
    // Entre 1/8" (3,18) e 5/32" (3,97): mais perto de 1/8".
    expect(formatInches("3,4")).toBe('1/8"');
    // Mais perto de 5/32".
    expect(formatInches("3,8")).toBe('5/32"');
  });

  it("breaks an exact tie toward the larger fraction", () => {
    // 3,571875 mm é o meio exato entre 1/8" e 5/32"; a especificação manda subir.
    expect(formatInches("3.571875")).toBe('5/32"');
  });

  it("splits whole inches from the fraction above 1 inch", () => {
    expect(formatInches("31,75")).toBe('1 1/4"');
    expect(formatInches("38,10")).toBe('1 1/2"');
    expect(formatInches("50,80")).toBe('2"');
  });

  /**
   * A tabela descreve a parte fracionária, e ela se repete a cada polegada. Estes casos cobrem a
   * faixa que o dia a dia usa de verdade — barras e chapas de metros — e não só as primeiras
   * polegadas.
   */
  it.each([
    ["63,5", '2 1/2"'],
    ["85,725", '3 3/8"'],
    ["125,41", '4 15/16"'],
    ["152,4", '6"'],
    ["304,8", '12"'],
    ["1000", '39 3/8"'],
    ["1200", '47 1/4"'],
    ["2540", '100"'],
    ["3000", '118 1/8"'],
    ["6000", '236 7/32"'],
  ])("keeps the same rule far above one inch: %s mm is %s", (millimeters, expected) => {
    expect(formatInches(millimeters)).toBe(expected);
  });

  it("applies every fraction of the table to a whole inch other than the first", () => {
    // A mesma tabela, deslocada de 3": se a regra valesse só abaixo de 1", isto quebraria.
    const threeInches = 76.2;
    for (const [millimeters, fraction] of OFFICIAL_TABLE) {
      const shifted = (threeInches + Number(millimeters.replace(",", "."))).toFixed(4);
      const expected = fraction === '1"' ? '4"' : `3 ${fraction}`;
      expect(formatInches(shifted)).toBe(expected);
    }
  });

  it("shows anything below 1/32 inch as zero", () => {
    expect(formatInches("0,3")).toBe('0"');
    expect(formatInches("0,001")).toBe('0"');
  });

  it("has nothing to show for a blank or invalid field", () => {
    expect(formatInches("")).toBeUndefined();
    expect(formatInches("0")).toBeUndefined();
  });
});

describe("formatMeasure", () => {
  it("shows the API's dot as the comma the user reads", () => {
    expect(formatMeasure("3.18")).toBe("3,18");
    expect(formatMeasure("1200")).toBe("1200");
    expect(formatMeasure(undefined)).toBe("");
  });
});
