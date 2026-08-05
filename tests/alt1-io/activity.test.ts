import { describe, expect, it } from "vitest";
import { MouseActivityWatch, type MousePoint } from "~/alt1-io/activity";

function harness(start = 1_000) {
  let t = start;
  let pos: MousePoint | null = { x: 10, y: 10 };
  const w = new MouseActivityWatch(
    () => pos,
    () => t,
  );
  return {
    watch: w,
    advance(ms: number) {
      t += ms;
    },
    move(next: MousePoint | null) {
      pos = next;
    },
  };
}

describe("MouseActivityWatch", () => {
  it("reports zero idle before the first poll", () => {
    expect(harness().watch.idleMs).toBe(0);
  });

  it("counts up while the cursor sits still", () => {
    const h = harness();
    h.watch.poll();
    h.advance(5_000);
    h.watch.poll();
    expect(h.watch.idleMs).toBe(5_000);
  });

  it("resets when the cursor moves", () => {
    const h = harness();
    h.watch.poll();
    h.advance(5_000);
    h.move({ x: 11, y: 10 });
    h.watch.poll();
    expect(h.watch.idleMs).toBe(0);
  });

  it("treats a one-pixel move as movement", () => {
    const h = harness();
    h.watch.poll();
    h.advance(3_000);
    h.move({ x: 10, y: 11 });
    h.watch.poll();
    expect(h.watch.idleMs).toBe(0);
  });

  it("keeps counting when the cursor returns to the same spot between polls", () => {
    const h = harness();
    h.watch.poll();
    h.advance(2_000);
    h.watch.poll();
    h.advance(2_000);
    h.watch.poll();
    expect(h.watch.idleMs).toBe(4_000);
  });

  // Leaving the client is itself one movement; after that, idle keeps growing,
  // which matches the game -- a cursor outside the client is not hovering it.
  it("treats leaving the client as a movement, then keeps counting", () => {
    const h = harness();
    h.watch.poll();
    h.advance(4_000);
    h.move(null);
    h.watch.poll();
    expect(h.watch.idleMs).toBe(0);

    h.advance(6_000);
    h.watch.poll();
    expect(h.watch.idleMs).toBe(6_000);
  });

  it("treats re-entering the client as a movement", () => {
    const h = harness();
    h.move(null);
    h.watch.poll();
    h.advance(9_000);
    h.move({ x: 5, y: 5 });
    h.watch.poll();
    expect(h.watch.idleMs).toBe(0);
  });

  it("continues accruing idle time between polls", () => {
    const h = harness();
    h.watch.poll();
    h.advance(1_500);
    expect(h.watch.idleMs).toBe(1_500);
  });
});
