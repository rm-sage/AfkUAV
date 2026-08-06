import { describe, expect, it } from "vitest";
import { MouseActivityWatch, type MousePoint } from "~/alt1-io/activity";

function harness(start = 1_000) {
  let t = start;
  let pos: MousePoint | null = { x: 10, y: 10 };
  let active = true;
  const w = new MouseActivityWatch(
    () => pos,
    () => t,
    () => active,
  );
  return {
    watch: w,
    advance(ms: number) {
      t += ms;
    },
    move(next: MousePoint | null) {
      pos = next;
    },
    setActive(next: boolean) {
      active = next;
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

// The reported bug: a fullscreen window covering the game on the same monitor.
// alt1.mousePosition still reports a position because the cursor is inside the
// client rectangle, so navigating that window read as hovering the game and
// reset the lobby timer.
describe("MouseActivityWatch while RuneScape is not the active window", () => {
  it("ignores movement over a window covering the game", () => {
    const h = harness();
    h.watch.poll();
    h.setActive(false);
    h.watch.poll();

    // Cursor moves repeatedly across the covering window.
    for (let i = 0; i < 5; i++) {
      h.advance(1_000);
      h.move({ x: 100 + i * 10, y: 200 + i * 10 });
      h.watch.poll();
    }
    expect(h.watch.idleMs).toBe(5_000);
  });

  it("keeps accruing idle while the game is in the background", () => {
    const h = harness();
    h.watch.poll();
    h.setActive(false);
    h.watch.poll();
    h.advance(30_000);
    h.watch.poll();
    expect(h.watch.idleMs).toBe(30_000);
  });

  // Coming back to the game is itself an interaction, so one reset is right.
  it("counts refocusing the game as activity", () => {
    const h = harness();
    h.setActive(false);
    h.watch.poll();
    h.advance(9_000);
    h.setActive(true);
    h.watch.poll();
    expect(h.watch.idleMs).toBe(0);
  });

  it("resumes tracking movement once the game is active again", () => {
    const h = harness();
    h.setActive(false);
    h.watch.poll();
    h.setActive(true);
    h.watch.poll();
    h.advance(4_000);
    h.watch.poll();
    expect(h.watch.idleMs).toBe(4_000);
    h.move({ x: 55, y: 55 });
    h.watch.poll();
    expect(h.watch.idleMs).toBe(0);
  });
});
