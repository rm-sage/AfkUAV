import { describe, expect, it, vi } from "vitest";
import { AnchoredReader, type ReaderLike } from "~/readers/anchored-reader";

type Pos = { at: number };

function fake(
  posSource: Pos | null | (() => Pos | null),
  out: unknown | null | (() => unknown | null),
  spy?: { finds: number; reads: number; pinned: (Pos | null)[] },
): ReaderLike<Pos, unknown> {
  return {
    pos: null,
    find() {
      if (spy) spy.finds++;
      return typeof posSource === "function" ? posSource() : posSource;
    },
    read(this: ReaderLike<Pos, unknown>) {
      if (spy) {
        spy.reads++;
        spy.pinned.push(this.pos);
      }
      return typeof out === "function" ? (out as () => unknown)() : out;
    },
  };
}

describe("AnchoredReader", () => {
  it("builds the underlying reader lazily", () => {
    const make = vi.fn(() => fake({ at: 1 }, "data"));
    const r = new AnchoredReader({ make });
    expect(make).not.toHaveBeenCalled();
    r.update(1, {});
    expect(make).toHaveBeenCalledTimes(1);
  });

  it("finds once and reuses the position", () => {
    const spy = { finds: 0, reads: 0, pinned: [] as (Pos | null)[] };
    const r = new AnchoredReader({ make: () => fake({ at: 1 }, "data", spy) });
    r.update(1, {});
    r.update(2, {});
    r.update(3, {});
    expect(spy.finds).toBe(1);
    expect(spy.reads).toBe(3);
  });

  it("returns the reader's output", () => {
    const r = new AnchoredReader({ make: () => fake({ at: 1 }, "hello") });
    expect(r.update(1, {})).toBe("hello");
  });

  it("returns null and stays unfound when the target is absent", () => {
    const r = new AnchoredReader({ make: () => fake(null, "data") });
    expect(r.update(1, {})).toBeNull();
    expect(r.found).toBe(false);
  });

  // find() reassigns the reader's own pos; the anchor must remain authoritative.
  it("re-pins the anchored position before every read", () => {
    const spy = { finds: 0, reads: 0, pinned: [] as (Pos | null)[] };
    const r = new AnchoredReader({ make: () => fake({ at: 7 }, "data", spy) });
    r.update(1, {});
    r.update(2, {});
    expect(spy.pinned).toEqual([{ at: 7 }, { at: 7 }]);
  });

  it("re-finds after invalidation", () => {
    const spy = { finds: 0, reads: 0, pinned: [] as (Pos | null)[] };
    const r = new AnchoredReader({ make: () => fake({ at: 1 }, "data", spy) });
    r.update(1, {});
    r.invalidate("geometry-change");
    r.update(2, {});
    expect(spy.finds).toBe(2);
    expect(r.health.lastInvalidation).toBe("geometry-change");
  });

  it("self-heals after repeated null reads", () => {
    const spy = { finds: 0, reads: 0, pinned: [] as (Pos | null)[] };
    const r = new AnchoredReader({
      make: () => fake({ at: 1 }, null, spy),
      maxEmptyReads: 3,
    });
    for (let t = 1; t <= 5; t++) r.update(t, {});
    expect(spy.finds).toBeGreaterThan(1);
  });

  // An empty array is a successful read of nothing for some readers and a sign of
  // a bad position for others, so the caller decides.
  it("treats structurally-empty output as an empty read when told to", () => {
    const spy = { finds: 0, reads: 0, pinned: [] as (Pos | null)[] };
    const r = new AnchoredReader<Pos, unknown[]>({
      make: () => fake({ at: 1 }, [], spy) as ReaderLike<Pos, unknown[]>,
      maxEmptyReads: 2,
      isEmpty: (out) => out.length === 0,
    });
    for (let t = 1; t <= 4; t++) r.update(t, {});
    expect(spy.finds).toBeGreaterThan(1);
  });

  it("does not re-find on empty output without isEmpty", () => {
    const spy = { finds: 0, reads: 0, pinned: [] as (Pos | null)[] };
    const r = new AnchoredReader({ make: () => fake({ at: 1 }, [], spy), maxEmptyReads: 2 });
    for (let t = 1; t <= 4; t++) r.update(t, {});
    expect(spy.finds).toBe(1);
  });

  it("survives a reader that throws", () => {
    const r = new AnchoredReader({
      make: () => ({
        pos: null,
        find: () => ({ at: 1 }),
        read() {
          throw new Error("decode failed");
        },
      }),
    });
    expect(() => r.update(1, {})).not.toThrow();
    expect(r.update(2, {})).toBeNull();
  });
});
