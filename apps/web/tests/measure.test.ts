import { describe, expect, it } from "vitest";

import {
  formatMeasure,
  isMeasureInput,
  parseMeasureInput,
  toInches,
} from "../src/features/registry/measure.js";

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

describe("toInches", () => {
  it("converts using the exact ratio, so the sector's measurements are recognizable", () => {
    expect(toInches("25,4")).toBe("1");
    expect(toInches("3,18")).toBe("0,125");
    expect(toInches("50.8")).toBe("2");
  });

  it("has nothing to show for a blank or invalid field", () => {
    expect(toInches("")).toBeUndefined();
    expect(toInches("0")).toBeUndefined();
  });
});

describe("formatMeasure", () => {
  it("shows the API's dot as the comma the user reads", () => {
    expect(formatMeasure("3.18")).toBe("3,18");
    expect(formatMeasure("1200")).toBe("1200");
    expect(formatMeasure(undefined)).toBe("");
  });
});
