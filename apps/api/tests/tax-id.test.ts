import { describe, expect, it } from "vitest";

import { normalizeTaxId } from "../src/partners/tax-id.js";

describe("normalizeTaxId", () => {
  it.each([
    ["12.345.678/0001-90", "12345678000190"],
    ["  123.456.789-01  ", "12345678901"],
    ["ab.cde/12-34", "ABCDE1234"],
    ["AB CDE 12 34", "ABCDE1234"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeTaxId(input)).toBe(expected);
  });
});
