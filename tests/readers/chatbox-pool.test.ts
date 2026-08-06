import { describe, expect, it, vi } from "vitest";
import { ChatboxPool, type BoxLike, type ChatPos, type ChatboxLike } from "~/readers/chatbox-pool";
import type { ChatLine, RGB } from "~/engine/types";

function box(x: number, y: number): BoxLike {
  return { rect: { x, y, width: 400, height: 120 }, type: "main" };
}

function line(text: string, color: RGB = [255, 255, 255]): ChatLine {
  return { text, colors: [color], fragments: [text] };
}

/**
 * Fake ChatBoxReader. `linesFor` is keyed by the pinned box's x coordinate so a
 * test can give each box distinct content.
 */
function makeFake(
  pos: ChatPos | null | (() => ChatPos | null),
  linesFor: (boxX: number) => ChatLine[] | null,
  spy?: { finds: number; reads: number[] },
): ChatboxLike {
  return {
    pos: null,
    readargs: { colors: [] },
    find() {
      if (spy) spy.finds++;
      // Accepts a getter so a test can change the detected layout mid-run: the
      // pool builds its discovery reader once, so a by-value capture would freeze.
      return typeof pos === "function" ? pos() : pos;
    },
    read(this: ChatboxLike) {
      const x = this.pos?.mainbox.rect.x ?? -1;
      if (spy) spy.reads.push(x);
      return linesFor(x);
    },
  };
}

describe("ChatboxPool", () => {
  it("reads every detected box, not just mainbox", () => {
    const pos: ChatPos = { mainbox: box(0, 0), boxes: [box(0, 0), box(500, 0)] };
    const spy = { finds: 0, reads: [] as number[] };
    const pool = new ChatboxPool({
      makeReader: () =>
        makeFake(pos, (x) => (x === 0 ? [line("from left")] : [line("from right")]), spy),
    });

    const out = pool.update(1, {}, []);
    expect(pool.boxCount).toBe(2);
    expect(out.map((l) => l.text).sort()).toEqual(["from left", "from right"]);
    expect(spy.reads.sort()).toEqual([0, 500]);
  });

  it("dedupes a line appearing in more than one box", () => {
    const pos: ChatPos = { mainbox: box(0, 0), boxes: [box(0, 0), box(500, 0)] };
    const pool = new ChatboxPool({ makeReader: () => makeFake(pos, () => [line("same message")]) });
    expect(pool.update(1, {}, []).map((l) => l.text)).toEqual(["same message"]);
  });

  it("treats identical text in different colours as distinct", () => {
    const pos: ChatPos = { mainbox: box(0, 0), boxes: [box(0, 0), box(500, 0)] };
    const pool = new ChatboxPool({
      makeReader: () =>
        makeFake(pos, (x) =>
          x === 0 ? [line("dup", [255, 0, 0])] : [line("dup", [0, 255, 0])],
        ),
    });
    expect(pool.update(1, {}, [])).toHaveLength(2);
  });

  it("falls back to mainbox when boxes is empty", () => {
    const pos: ChatPos = { mainbox: box(7, 7), boxes: [] };
    const pool = new ChatboxPool({ makeReader: () => makeFake(pos, () => [line("only")]) });
    expect(pool.update(1, {}, []).map((l) => l.text)).toEqual(["only"]);
    expect(pool.boxCount).toBe(1);
  });

  // find() reassigns `pos` and re-picks mainbox itself, so pinning has to happen
  // before every read or the reader silently reverts to its own preference.
  it("pins each reader to its own box before reading", () => {
    const pos: ChatPos = { mainbox: box(0, 0), boxes: [box(0, 0), box(500, 0)] };
    const spy = { finds: 0, reads: [] as number[] };
    const pool = new ChatboxPool({ makeReader: () => makeFake(pos, () => [], spy) });
    pool.update(1, {}, []);
    expect(spy.reads).toContain(0);
    expect(spy.reads).toContain(500);
  });

  it("re-sets readargs.colors on every update rather than caching", () => {
    const pos: ChatPos = { mainbox: box(0, 0), boxes: [box(0, 0)] };
    const readers: ChatboxLike[] = [];
    const pool = new ChatboxPool({
      makeReader: () => {
        const r = makeFake(pos, () => [line("x")]);
        readers.push(r);
        return r;
      },
      mixColor: (r, g, b) => (r << 16) | (g << 8) | b,
    });

    pool.update(1, {}, [[255, 0, 0]]);
    const boxReader = readers[readers.length - 1]!;
    expect(boxReader.readargs.colors).toEqual([0xff0000]);

    // A preset switch changes the colour union; a cached snapshot would drop it.
    pool.update(2, {}, [[0, 255, 0], [0, 0, 255]]);
    expect(boxReader.readargs.colors).toEqual([0x00ff00, 0x0000ff]);
  });

  it("returns nothing and reports zero boxes when discovery fails", () => {
    const pool = new ChatboxPool({ makeReader: () => makeFake(null, () => null) });
    expect(pool.update(1, {}, [])).toEqual([]);
    expect(pool.boxCount).toBe(0);
    expect(pool.health.state).toBe("lost");
  });

  it("discovers once and reuses the position on later ticks", () => {
    const pos: ChatPos = { mainbox: box(0, 0), boxes: [box(0, 0)] };
    const spy = { finds: 0, reads: [] as number[] };
    const pool = new ChatboxPool({ makeReader: () => makeFake(pos, () => [line("x")], spy) });
    pool.update(1, {}, []);
    pool.update(2, {}, []);
    pool.update(3, {}, []);
    expect(spy.finds).toBe(1);
  });

  it("rediscovers after invalidate", () => {
    const pos: ChatPos = { mainbox: box(0, 0), boxes: [box(0, 0)] };
    const spy = { finds: 0, reads: [] as number[] };
    const pool = new ChatboxPool({ makeReader: () => makeFake(pos, () => [line("x")], spy) });
    pool.update(1, {}, []);
    pool.invalidate("resize");
    pool.update(2, {}, []);
    expect(spy.finds).toBe(2);
    expect(pool.health.lastInvalidation).toBe("resize");
  });

  // The AfkWarden failure mode: a stale position produces nothing forever.
  it("self-heals after repeated empty reads", () => {
    const pos: ChatPos = { mainbox: box(0, 0), boxes: [box(0, 0)] };
    const spy = { finds: 0, reads: [] as number[] };
    const pool = new ChatboxPool({
      makeReader: () => makeFake(pos, () => [], spy),
      maxEmptyReads: 3,
    });
    for (let t = 1; t <= 5; t++) pool.update(t, {}, []);
    expect(spy.finds).toBeGreaterThan(1);
  });

  it("drops readers for boxes that disappear", () => {
    let pos: ChatPos = { mainbox: box(0, 0), boxes: [box(0, 0), box(500, 0)] };
    const made = vi.fn(() => makeFake(() => pos, () => [line("x")]));
    const pool = new ChatboxPool({ makeReader: made });

    pool.update(1, {}, []);
    expect(pool.boxCount).toBe(2);
    const afterTwoBoxes = made.mock.calls.length;

    pos = { mainbox: box(0, 0), boxes: [box(0, 0)] };
    pool.invalidate("layout");
    pool.update(2, {}, []);
    expect(pool.boxCount).toBe(1);

    // Re-adding the second box must build a fresh reader, not resurrect stale
    // diff state from the old one.
    pos = { mainbox: box(0, 0), boxes: [box(0, 0), box(500, 0)] };
    pool.invalidate("layout");
    pool.update(3, {}, []);
    expect(made.mock.calls.length).toBeGreaterThan(afterTwoBoxes);
  });
});
