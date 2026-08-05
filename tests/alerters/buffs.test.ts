import { beforeEach, describe, expect, it } from "vitest";
import { buffsAlerter, compensateAbbreviation } from "~/alerters/buffs";
import { clearNeedleCache, primeNeedle } from "~/readers/needle-cache";
import { coverage, type Needle } from "~/readers/buff-match";
import type { AlerterContext } from "~/engine/types";
import { NULL_READERS, type BuffSlot } from "~/readers/bundle";

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

const solid = (v: number) => (): RGBA => [v, v, v, 255];

/** The real measured Overload-timer template: 53 opaque pixels. */
const sparse53 = () => make(25, 25, (x, y) => (y * 25 + x < 53 ? [7, 7, 7, 255] : [0, 0, 0, 0]));

const IMG = "fake-base64";

function ctx(slots: BuffSlot[] | null, now = 0, over: Partial<AlerterContext> = {}): AlerterContext {
  return {
    tick: 1,
    now,
    idleMs: 0,
    mouseIdleMs: 0,
    hasGameState: true,
    chatLines: [],
    chatAvailable: true,
    readers: { ...NULL_READERS, buffs: () => slots, debuffs: () => slots },
    geometry: null,
    ...over,
  };
}

beforeEach(() => {
  clearNeedleCache();
});

describe("compensateAbbreviation", () => {
  // RS truncates long timers, so a displayed value is a floor.
  it("leaves sub-minute values alone", () => {
    expect(compensateAbbreviation(0)).toBe(0);
    expect(compensateAbbreviation(59)).toBe(59);
  });

  it("adds a minute once the display is in minutes", () => {
    expect(compensateAbbreviation(60)).toBe(120);
    expect(compensateAbbreviation(300)).toBe(360);
  });

  it("adds an hour once the display is in hours", () => {
    expect(compensateAbbreviation(3600)).toBe(7200);
  });
});

describe("buffsAlerter", () => {
  const vars = {
    bufftype: { buffid: "", imgstr: IMG, isdebuff: false },
    starttime: 360,
    endtime: 30,
  };

  it("is non-functional with no captured icon", () => {
    const a = buffsAlerter.create({ ...vars, bufftype: { buffid: "", imgstr: "", isdebuff: false } });
    expect(a.check(ctx([])).functional).toBe(false);
  });

  it("is non-functional until the icon finishes decoding", () => {
    const a = buffsAlerter.create(vars);
    // Nothing primed, so the needle is still decoding.
    expect(a.check(ctx([])).functional).toBe(false);
  });

  it("is non-functional when the buff bar is not found", () => {
    primeNeedle(IMG, sparse53());
    const a = buffsAlerter.create(vars);
    expect(a.check(ctx(null)).functional).toBe(false);
  });

  it("reads the remaining time of a matching buff", () => {
    primeNeedle(IMG, sparse53());
    const a = buffsAlerter.create(vars);
    const slots: BuffSlot[] = [{ icon: make(25, 25, solid(7)), timeLeft: 40 }];
    const r = a.check(ctx(slots));
    expect(r.functional).toBe(true);
    // 40s reads as under a minute, so no compensation; above endtime 30.
    expect(r.triggered).toBe(false);
  });

  it("triggers at or below endtime", () => {
    primeNeedle(IMG, sparse53());
    const a = buffsAlerter.create(vars);
    expect(a.check(ctx([{ icon: make(25, 25, solid(7)), timeLeft: 30 }])).triggered).toBe(true);
    expect(a.check(ctx([{ icon: make(25, 25, solid(7)), timeLeft: 5 }])).triggered).toBe(true);
  });

  // A buff that vanished has expired -- that is the whole point of the alert.
  it("treats an absent buff as expired", () => {
    primeNeedle(IMG, sparse53());
    const a = buffsAlerter.create(vars);
    const other: BuffSlot[] = [{ icon: make(25, 25, solid(200)), timeLeft: 500 }];
    const r = a.check(ctx(other));
    expect(r.functional).toBe(true);
    expect(r.triggered).toBe(true);
    expect(r.bar).toBe(1);
  });

  it("fills the bar as the buff runs down", () => {
    primeNeedle(IMG, sparse53());
    const a = buffsAlerter.create(vars);
    const at = (t: number) => a.check(ctx([{ icon: make(25, 25, solid(7)), timeLeft: t }])).bar;
    // starttime 360; 30s reads as-is (under a minute).
    expect(at(30)).toBeCloseTo(1 - 30 / 360);
    expect(at(10)).toBeCloseTo(1 - 10 / 360);
  });

  it("picks the best matching slot among several buffs", () => {
    primeNeedle(IMG, sparse53());
    const a = buffsAlerter.create(vars);
    const slots: BuffSlot[] = [
      { icon: make(25, 25, solid(200)), timeLeft: 900 },
      { icon: make(25, 25, solid(7)), timeLeft: 12 },
      { icon: make(25, 25, solid(120)), timeLeft: 900 },
    ];
    expect(a.check(ctx(slots)).triggered).toBe(true);
  });

  it("reads debuffs when isdebuff is set", () => {
    primeNeedle(IMG, sparse53());
    const a = buffsAlerter.create({
      ...vars,
      bufftype: { buffid: "", imgstr: IMG, isdebuff: true },
    });
    const readers = { ...NULL_READERS, buffs: () => null, debuffs: () => [] as BuffSlot[] };
    const r = a.check({ ...ctx([]), readers });
    expect(r.functional).toBe(true);
  });

  it("interpolates downward between identical timer reads", () => {
    primeNeedle(IMG, sparse53());
    const a = buffsAlerter.create({ ...vars, endtime: 0 });
    const slot = () => [{ icon: make(25, 25, solid(7)), timeLeft: 40 }];

    const first = a.check(ctx(slot(), 0)).bar;
    // 10s later the on-screen number has not changed; the countdown should still
    // have advanced rather than sitting frozen.
    const later = a.check(ctx(slot(), 10_000)).bar;
    expect(later).toBeGreaterThan(first);
  });

  // The regression this alerter exists for.
  it("still matches a 53-opaque-pixel template", () => {
    const needle = sparse53();
    expect(coverage(needle)).toBe(53);
    primeNeedle(IMG, needle);

    const a = buffsAlerter.create(vars);
    const r = a.check(ctx([{ icon: make(25, 25, solid(7)), timeLeft: 5 }]));
    expect(r.triggered).toBe(true);
  });

  it("never mutates the template while matching", () => {
    const needle = sparse53();
    primeNeedle(IMG, needle);
    const a = buffsAlerter.create(vars);

    for (let i = 0; i < 50; i++) {
      a.check(ctx([{ icon: make(25, 25, solid(7)), timeLeft: 100 }]));
    }
    // AfkWarden would have eroded this below its own floor by now.
    expect(coverage(needle)).toBe(53);
  });
});
