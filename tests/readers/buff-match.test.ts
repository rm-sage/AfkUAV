import { describe, expect, it } from "vitest";
import {
  bestMatch,
  coverage,
  isLowCoverage,
  scoreNeedle,
  MATCH_THRESHOLD,
  type Needle,
} from "~/readers/buff-match";

type RGBA = [number, number, number, number];

function make(w: number, h: number, paint: (x: number, y: number) => RGBA): Needle {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = paint(x, y);
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  return { width: w, height: h, data };
}

const solid =
  (r: number, g: number, b: number) =>
  (): RGBA => [r, g, b, 255];

/** 53 opaque px: the real measured Overload-timer template, 3 above AfkWarden's floor of 50. */
const sparse53 = () => make(25, 25, (x, y) => (y * 25 + x < 53 ? [7, 7, 7, 255] : [0, 0, 0, 0]));

describe("coverage", () => {
  it("counts only fully opaque pixels", () => {
    expect(coverage(make(4, 4, solid(1, 2, 3)))).toBe(16);
    expect(coverage(make(4, 4, (): RGBA => [1, 2, 3, 0]))).toBe(0);
  });

  it("flags sparse needles as degraded", () => {
    const n = sparse53();
    expect(coverage(n)).toBe(53);
    expect(isLowCoverage(n)).toBe(true);
  });

  it("does not flag a healthy needle", () => {
    expect(isLowCoverage(make(25, 25, solid(9, 9, 9)))).toBe(false);
  });
});

describe("scoreNeedle", () => {
  it("scores an exact match as 1", () => {
    const n = make(5, 5, solid(10, 20, 30));
    expect(scoreNeedle(n, make(5, 5, solid(10, 20, 30))).score).toBe(1);
  });

  it("scores a total mismatch as 0", () => {
    const n = make(5, 5, solid(10, 20, 30));
    expect(scoreNeedle(n, make(5, 5, solid(200, 200, 200))).score).toBe(0);
  });

  it("ignores transparent needle pixels", () => {
    const n = make(4, 4, (x): RGBA => (x === 0 ? [10, 20, 30, 255] : [0, 0, 0, 0]));
    const hay = make(4, 4, (x): RGBA => (x === 0 ? [10, 20, 30, 255] : [255, 0, 0, 255]));
    const r = scoreNeedle(n, hay);
    expect(r.comparable).toBe(4);
    // Only 4 comparable pixels is below MIN_COMPARABLE_PIXELS, so the score is
    // suppressed even though every compared pixel matched.
    expect(r.matched).toBe(4);
    expect(r.score).toBe(0);
  });

  // The AfkWarden regression: an absolute 50-pixel floor leaves a 53-pixel template
  // three pixels from silent permanent failure. Relative scoring must not care.
  it("does not disadvantage a sparse needle", () => {
    const r = scoreNeedle(sparse53(), make(25, 25, solid(7, 7, 7)));
    expect(r.comparable).toBe(53);
    expect(r.score).toBe(1);
    expect(r.score).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
  });

  it("tolerates small per-channel differences from alpha blending", () => {
    const n = make(10, 10, solid(100, 100, 100));
    expect(scoreNeedle(n, make(10, 10, solid(110, 110, 110))).score).toBe(1);
    expect(scoreNeedle(n, make(10, 10, solid(200, 200, 200))).score).toBe(0);
  });

  it("returns score 0 when too few pixels are comparable to be meaningful", () => {
    const tiny = make(25, 25, (x, y): RGBA => (y * 25 + x < 5 ? [7, 7, 7, 255] : [0, 0, 0, 0]));
    expect(scoreNeedle(tiny, make(25, 25, solid(7, 7, 7))).score).toBe(0);
  });

  it("returns score 0 on a size mismatch", () => {
    expect(scoreNeedle(make(5, 5, solid(1, 1, 1)), make(6, 6, solid(1, 1, 1))).score).toBe(0);
  });
});

describe("bestMatch", () => {
  it("picks the highest scoring candidate above threshold", () => {
    const n = make(8, 8, solid(50, 50, 50));
    const r = bestMatch(n, [
      make(8, 8, solid(200, 200, 200)),
      make(8, 8, solid(50, 50, 50)),
      make(8, 8, solid(90, 90, 90)),
    ]);
    expect(r).not.toBeNull();
    expect(r!.index).toBe(1);
  });

  it("returns null when nothing clears the threshold", () => {
    const n = make(8, 8, solid(50, 50, 50));
    expect(bestMatch(n, [make(8, 8, solid(200, 200, 200))])).toBeNull();
  });

  it("returns null for an empty candidate list", () => {
    expect(bestMatch(make(8, 8, solid(1, 1, 1)), [])).toBeNull();
  });

  it("never mutates the needle -- no erosion ratchet", () => {
    const n = sparse53();
    const before = Uint8ClampedArray.from(n.data);
    bestMatch(n, [make(25, 25, solid(7, 7, 7)), make(25, 25, solid(9, 9, 9))]);
    expect(Array.from(n.data)).toEqual(Array.from(before));
    expect(coverage(n)).toBe(53);
  });
});
