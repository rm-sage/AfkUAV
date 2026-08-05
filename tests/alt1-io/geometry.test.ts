import { describe, expect, it } from "vitest";
import { GeometryWatch, readGeometry, type Alt1Host } from "~/alt1-io/geometry";

function host(over: Partial<Alt1Host> = {}): Alt1Host {
  return { rsX: 0, rsY: 0, rsWidth: 1920, rsHeight: 1080, rsScaling: 1, rsLinked: true, ...over };
}

describe("readGeometry", () => {
  it("returns null when RS is not linked", () => {
    expect(readGeometry(host({ rsLinked: false }))).toBeNull();
  });

  it("snapshots the client rect", () => {
    expect(readGeometry(host())).toEqual({ x: 0, y: 0, width: 1920, height: 1080, scaling: 1 });
  });
});

describe("GeometryWatch", () => {
  it("reports change on first poll", () => {
    expect(new GeometryWatch(host()).poll()).toBe(true);
  });

  it("reports no change when geometry is stable", () => {
    const w = new GeometryWatch(host());
    w.poll();
    expect(w.poll()).toBe(false);
  });

  it("detects a resize", () => {
    const h = host();
    const w = new GeometryWatch(h);
    w.poll();
    h.rsWidth = 1280;
    expect(w.poll()).toBe(true);
  });

  it("detects a UI scale change without a size change", () => {
    const h = host();
    const w = new GeometryWatch(h);
    w.poll();
    h.rsScaling = 2;
    expect(w.poll()).toBe(true);
  });

  // Reader coordinates are RS-client-relative, so a moved window needs no re-find.
  // Invalidating here would cost a re-find every time the user drags the game.
  it("does NOT report change when only the window moves", () => {
    const h = host();
    const w = new GeometryWatch(h);
    w.poll();
    h.rsX = 400;
    h.rsY = 300;
    expect(w.poll()).toBe(false);
  });

  it("reports change when RS unlinks", () => {
    const h = host();
    const w = new GeometryWatch(h);
    w.poll();
    h.rsLinked = false;
    expect(w.poll()).toBe(true);
  });

  it("reports change when RS relinks", () => {
    const h = host({ rsLinked: false });
    const w = new GeometryWatch(h);
    w.poll();
    h.rsLinked = true;
    expect(w.poll()).toBe(true);
  });
});
