import { describe, expect, it } from "vitest";
import { inactiveAlerter } from "~/alerters/inactive";
import type { AlerterContext } from "~/engine/types";

function ctx(over: Partial<AlerterContext> = {}): AlerterContext {
  return {
    tick: 1,
    now: 0,
    rsLastActive: 0,
    chatLines: [],
    geometry: null,
    ...over,
  };
}

describe("inactiveAlerter", () => {
  it("defaults to AfkWarden's lobby timer delay", () => {
    expect(inactiveAlerter.schema.parse({}).delay).toBe(570);
  });

  it("rejects a non-positive delay", () => {
    expect(() => inactiveAlerter.schema.parse({ delay: 0 })).toThrow();
    expect(() => inactiveAlerter.schema.parse({ delay: -5 })).toThrow();
  });

  it("does not trigger before the delay", () => {
    const a = inactiveAlerter.create({ delay: 10 });
    const r = a.check(ctx({ now: 9_000, rsLastActive: 0 }));
    expect(r.triggered).toBe(false);
    expect(r.bar).toBeCloseTo(0.9);
  });

  it("triggers exactly at the delay", () => {
    const a = inactiveAlerter.create({ delay: 10 });
    expect(a.check(ctx({ now: 10_000, rsLastActive: 0 })).triggered).toBe(true);
  });

  it("clamps the bar at 1 once well past the delay", () => {
    const a = inactiveAlerter.create({ delay: 10 });
    const r = a.check(ctx({ now: 999_000, rsLastActive: 0 }));
    expect(r.triggered).toBe(true);
    expect(r.bar).toBe(1);
  });

  it("un-triggers when the player interacts again", () => {
    const a = inactiveAlerter.create({ delay: 10 });
    expect(a.check(ctx({ now: 20_000, rsLastActive: 0 })).triggered).toBe(true);
    expect(a.check(ctx({ now: 20_000, rsLastActive: 19_000 })).triggered).toBe(false);
  });

  it("is always functional -- it needs no reader", () => {
    const a = inactiveAlerter.create({ delay: 10 });
    expect(a.check(ctx()).functional).toBe(true);
  });
});
