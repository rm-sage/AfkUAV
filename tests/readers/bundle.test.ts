import { describe, expect, it, vi } from "vitest";
import { AnchoredReader } from "~/readers/anchored-reader";
import { NULL_READERS, TickReaders, type ActionbarState, type BuffSlot } from "~/readers/bundle";

function stubReader<T>(out: T, onRead?: () => void): AnchoredReader<unknown, T> {
  return new AnchoredReader<unknown, T>({
    make: () => ({
      pos: null,
      find: () => ({}),
      read: () => {
        onRead?.();
        return out;
      },
    }),
  });
}

const BAR: ActionbarState = { hp: 0.5, pray: 0.9, sum: 1, dren: 0.2 };

describe("NULL_READERS", () => {
  it("reports nothing without throwing", () => {
    expect(NULL_READERS.actionbar()).toBeNull();
    expect(NULL_READERS.buffs()).toBeNull();
    expect(NULL_READERS.xp("div")).toBeNull();
    expect(NULL_READERS.health("buffs")).toBeNull();
  });
});

describe("TickReaders", () => {
  it("returns nothing before a tick begins", () => {
    const r = new TickReaders({ actionbar: stubReader(BAR) });
    expect(r.actionbar()).toBeNull();
  });

  it("reads through to the underlying reader", () => {
    const r = new TickReaders({ actionbar: stubReader(BAR) });
    r.beginTick(1, {});
    expect(r.actionbar()).toEqual(BAR);
  });

  // Ten buff alerts must not cost ten reads of the buff bar.
  it("memoizes within a tick", () => {
    const onRead = vi.fn();
    const r = new TickReaders({ actionbar: stubReader(BAR, onRead) });
    r.beginTick(1, {});
    r.actionbar();
    r.actionbar();
    r.actionbar();
    expect(onRead).toHaveBeenCalledTimes(1);
  });

  it("re-reads on the next tick", () => {
    const onRead = vi.fn();
    const r = new TickReaders({ actionbar: stubReader(BAR, onRead) });
    r.beginTick(1, {});
    r.actionbar();
    r.beginTick(2, {});
    r.actionbar();
    expect(onRead).toHaveBeenCalledTimes(2);
  });

  // A preset with only chat alerts should never pay for buff OCR.
  it("does not read a source nobody asks for", () => {
    const onRead = vi.fn();
    const r = new TickReaders({ buffs: stubReader<BuffSlot[]>([], onRead) });
    r.beginTick(1, {});
    r.actionbar();
    expect(onRead).not.toHaveBeenCalled();
  });

  it("returns null for sources that are not configured", () => {
    const r = new TickReaders({});
    r.beginTick(1, {});
    expect(r.actionbar()).toBeNull();
    expect(r.buffs()).toBeNull();
    expect(r.xp("total")).toBeNull();
  });

  it("looks up xp by skill code", () => {
    const table = new Map([["div", 1234], ["total", 99]]);
    const r = new TickReaders({ xp: stubReader<ReadonlyMap<string, number>>(table) });
    r.beginTick(1, {});
    expect(r.xp("div")).toBe(1234);
    expect(r.xp("total")).toBe(99);
    expect(r.xp("wc")).toBeNull();
  });

  it("exposes per-reader health", () => {
    const r = new TickReaders({ actionbar: stubReader(BAR) });
    r.beginTick(1, {});
    r.actionbar();
    expect(r.health("actionbar")?.state).toBe("ok");
    expect(r.health("buffs")).toBeNull();
  });

  it("invalidates every configured reader", () => {
    const actionbar = stubReader(BAR);
    const buffs = stubReader<BuffSlot[]>([]);
    const r = new TickReaders({ actionbar, buffs });
    r.beginTick(1, {});
    r.actionbar();
    r.buffs();

    r.invalidateAll("geometry-change");
    expect(actionbar.health.lastInvalidation).toBe("geometry-change");
    expect(buffs.health.lastInvalidation).toBe("geometry-change");
  });
});
