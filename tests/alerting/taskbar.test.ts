import { describe, expect, it, vi } from "vitest";
import {
  TASKBAR_ERROR,
  TASKBAR_NONE,
  TASKBAR_NORMAL,
  TaskbarBar,
  shouldSuppress,
  taskbarState,
  type ProgressSource,
} from "~/alerting/taskbar";

function src(over: Partial<ProgressSource> = {}): ProgressSource {
  return { paused: false, triggered: false, bar: 0, exportbar: true, ...over };
}

describe("taskbarState", () => {
  it("is cleared when the overlay setting is off", () => {
    expect(taskbarState([src({ bar: 0.5 })], false)).toEqual({ type: TASKBAR_NONE, progress: 0 });
  });

  // A sliver of bar reads as "armed"; nothing at all reads as "not running".
  it("keeps a minimum sliver visible with nothing pending", () => {
    expect(taskbarState([], true)).toEqual({ type: TASKBAR_NORMAL, progress: 1 });
  });

  it("tracks the furthest-along exporting alert", () => {
    const s = taskbarState([src({ bar: 0.2 }), src({ bar: 0.65 }), src({ bar: 0.4 })], true);
    expect(s.progress).toBe(65);
    expect(s.type).toBe(TASKBAR_NORMAL);
  });

  it("ignores alerts that did not opt in", () => {
    const s = taskbarState([src({ bar: 0.9, exportbar: false }), src({ bar: 0.3 })], true);
    expect(s.progress).toBe(30);
  });

  it("ignores paused alerts", () => {
    const s = taskbarState([src({ bar: 0.9, paused: true }), src({ bar: 0.25 })], true);
    expect(s.progress).toBe(25);
  });

  it("jumps to full when anything fires", () => {
    const s = taskbarState([src({ bar: 0.1, triggered: true })], true);
    expect(s.progress).toBe(100);
    expect(s.type).toBe(TASKBAR_ERROR);
  });

  it("fills from a triggered alert even if it does not export a bar", () => {
    const s = taskbarState([src({ triggered: true, exportbar: false })], true);
    expect(s.progress).toBe(100);
  });

  it("turns red as time runs out", () => {
    expect(taskbarState([src({ bar: 0.79 })], true).type).toBe(TASKBAR_NORMAL);
    expect(taskbarState([src({ bar: 0.8 })], true).type).toBe(TASKBAR_ERROR);
  });

  it("does not count a paused alert as triggered", () => {
    const s = taskbarState([src({ triggered: true, paused: true })], true);
    expect(s.progress).toBe(1);
  });
});

describe("TaskbarBar", () => {
  it("pushes only on change", () => {
    const set = vi.fn();
    const bar = new TaskbarBar(set);
    bar.apply({ type: TASKBAR_NORMAL, progress: 40 });
    bar.apply({ type: TASKBAR_NORMAL, progress: 40 });
    bar.apply({ type: TASKBAR_NORMAL, progress: 41 });
    expect(set).toHaveBeenCalledTimes(2);
    expect(set).toHaveBeenLastCalledWith(TASKBAR_NORMAL, 41);
  });

  it("pushes when only the style changes", () => {
    const set = vi.fn();
    const bar = new TaskbarBar(set);
    bar.apply({ type: TASKBAR_NORMAL, progress: 80 });
    bar.apply({ type: TASKBAR_ERROR, progress: 80 });
    expect(set).toHaveBeenCalledTimes(2);
  });

  // Otherwise closing the app leaves the RuneScape icon decorated forever.
  it("clears the bar on shutdown", () => {
    const set = vi.fn();
    const bar = new TaskbarBar(set);
    bar.apply({ type: TASKBAR_NORMAL, progress: 50 });
    bar.clear();
    expect(set).toHaveBeenLastCalledWith(TASKBAR_NONE, 0);
  });

  it("is inert without a host setter", () => {
    expect(() => new TaskbarBar(null).apply({ type: 1, progress: 5 })).not.toThrow();
  });
});

describe("shouldSuppress", () => {
  it("never suppresses when the setting is off", () => {
    expect(shouldSuppress(false, 0, true)).toBe(false);
  });

  // Keyed off recent clicks, not focus: alt-tabbing to read something does not
  // mean you stopped playing, but having just clicked does.
  it("suppresses right after a click regardless of focus", () => {
    expect(shouldSuppress(true, 1_000, false)).toBe(true);
    expect(shouldSuppress(true, 3_999, false)).toBe(true);
  });

  it("extends the window while RuneScape is focused", () => {
    expect(shouldSuppress(true, 5_000, true)).toBe(true);
    expect(shouldSuppress(true, 5_000, false)).toBe(false);
  });

  it("stops suppressing once you have been idle a while", () => {
    expect(shouldSuppress(true, 7_000, true)).toBe(false);
    expect(shouldSuppress(true, 60_000, true)).toBe(false);
  });
});
