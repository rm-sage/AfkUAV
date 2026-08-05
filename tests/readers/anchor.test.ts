import { describe, expect, it, vi } from "vitest";
import { ReaderAnchor } from "~/readers/anchor";

describe("ReaderAnchor", () => {
  it("finds lazily and caches within a session", () => {
    const find = vi.fn(() => ({ box: 1 }));
    const a = new ReaderAnchor({ find });
    expect(a.get(1)).toEqual({ box: 1 });
    expect(a.get(2)).toEqual({ box: 1 });
    expect(find).toHaveBeenCalledTimes(1);
  });

  it("attempts find at most once per tick when the target is absent", () => {
    const find = vi.fn(() => null);
    const a = new ReaderAnchor({ find });
    a.get(1);
    a.get(1);
    a.get(1);
    expect(find).toHaveBeenCalledTimes(1);
    a.get(2);
    expect(find).toHaveBeenCalledTimes(2);
  });

  it("re-finds after explicit invalidation", () => {
    const find = vi.fn(() => ({ box: 1 }));
    const a = new ReaderAnchor({ find });
    a.get(1);
    a.invalidate("resize");
    a.get(2);
    expect(find).toHaveBeenCalledTimes(2);
    expect(a.health.lastInvalidation).toBe("resize");
  });

  // The core regression test for AfkWarden's defect: it caches reader positions for
  // the whole session and never recovers. This must self-heal.
  it("self-heals after consecutive empty reads", () => {
    const find = vi.fn(() => ({ box: 1 }));
    const a = new ReaderAnchor({ find, maxEmptyReads: 3 });
    a.get(1);
    for (let i = 0; i < 3; i++) a.reportRead(false);
    a.get(2);
    expect(find).toHaveBeenCalledTimes(2);
    expect(a.health.lastInvalidation).toBe("empty-reads");
  });

  it("resets the empty-read counter on a successful read", () => {
    const find = vi.fn(() => ({ box: 1 }));
    const a = new ReaderAnchor({ find, maxEmptyReads: 3 });
    a.get(1);
    a.reportRead(false);
    a.reportRead(false);
    a.reportRead(true);
    a.reportRead(false);
    a.get(2);
    expect(find).toHaveBeenCalledTimes(1);
    expect(a.health.emptyReads).toBe(1);
  });

  it("re-finds after the TTL expires", () => {
    const find = vi.fn(() => ({ box: 1 }));
    const a = new ReaderAnchor({ find, ttlTicks: 10 });
    a.get(1);
    a.get(5);
    expect(find).toHaveBeenCalledTimes(1);
    a.get(12);
    expect(find).toHaveBeenCalledTimes(2);
    expect(a.health.lastInvalidation).toBe("ttl");
  });

  it("reports health transitions", () => {
    let found: { box: number } | null = null;
    const a = new ReaderAnchor({ find: () => found });
    expect(a.health.state).toBe("searching");
    a.get(1);
    expect(a.health.state).toBe("lost");
    found = { box: 1 };
    a.get(2);
    expect(a.health.state).toBe("ok");
    expect(a.health.foundAtTick).toBe(2);
  });

  it("counts find attempts for diagnostics", () => {
    const a = new ReaderAnchor({ find: () => null });
    a.get(1);
    a.get(2);
    a.get(3);
    expect(a.health.findAttempts).toBe(3);
  });
});
