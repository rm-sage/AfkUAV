import { describe, expect, it } from "vitest";
import { __targetFor as targetFor } from "~/ui/useDragList";

/** Four 40px rows starting at y=100. */
const rows = [0, 1, 2, 3].map((index) => ({
  index,
  top: 100 + index * 40,
  bottom: 140 + index * 40,
  height: 40,
}));

describe("targetFor", () => {
  it("returns nothing for an empty list", () => {
    expect(targetFor([], 120, 0)).toBeNull();
  });

  it("drops at the top when above every row", () => {
    expect(targetFor(rows, 10, 3)).toEqual({ kind: "at", index: 0 });
  });

  it("drops at the end when below every row", () => {
    expect(targetFor(rows, 900, 0)).toEqual({ kind: "at", index: 4 });
  });

  it("drops before a row when in its upper edge", () => {
    // Row 1 spans 140..180; 145 is above its centre band.
    expect(targetFor(rows, 145, 3)).toEqual({ kind: "at", index: 1 });
  });

  it("drops after a row when in its lower edge", () => {
    expect(targetFor(rows, 175, 3)).toEqual({ kind: "at", index: 2 });
  });

  // Reserving the centre for grouping is what lets one gesture mean both things.
  it("groups when over the centre of another row", () => {
    expect(targetFor(rows, 160, 3)).toEqual({ kind: "onto", index: 1 });
  });

  it("never groups a row with itself", () => {
    const r = targetFor(rows, 160, 1);
    expect(r).not.toBeNull();
    expect(r!.kind).toBe("at");
  });

  it("still reorders past the row being dragged", () => {
    expect(targetFor(rows, 145, 1)).toEqual({ kind: "at", index: 1 });
    expect(targetFor(rows, 175, 1)).toEqual({ kind: "at", index: 2 });
  });

  it("treats the exact top and bottom edges as boundaries, not grouping", () => {
    expect(targetFor(rows, 100, 3)).toEqual({ kind: "at", index: 0 });
    expect(targetFor(rows, 140, 3)?.kind).toBe("at");
  });
});
