import { describe, expect, it } from "vitest";
import { toPitch, toRate } from "~/alerting/speech";

// AfkWarden stores speed as words-per-minute (50..500, default 175) and pitch as
// 0..100 (default 50). Web Speech takes rate 0.1..10 and pitch 0..2, so imported
// voice settings have to be converted or every alert sounds wrong.
describe("toRate", () => {
  it("maps AfkWarden's default speed to neutral rate", () => {
    expect(toRate(175)).toBeCloseTo(1);
  });

  it("maps faster speech above 1", () => {
    expect(toRate(350)).toBeCloseTo(2);
  });

  it("maps slower speech below 1", () => {
    expect(toRate(87.5)).toBeCloseTo(0.5);
  });

  it("clamps to the Web Speech range", () => {
    expect(toRate(0)).toBe(0.1);
    expect(toRate(100_000)).toBe(10);
  });
});

describe("toPitch", () => {
  it("maps AfkWarden's neutral pitch to 1", () => {
    expect(toPitch(50)).toBeCloseTo(1);
  });

  it("maps the extremes", () => {
    expect(toPitch(0)).toBe(0);
    expect(toPitch(100)).toBe(2);
  });

  it("clamps out-of-range input", () => {
    expect(toPitch(-50)).toBe(0);
    expect(toPitch(500)).toBe(2);
  });
});
