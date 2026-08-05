/**
 * Minimal surface of the Alt1 host that geometry tracking needs.
 *
 * Declared as an interface rather than reaching for the `alt1` global directly so
 * every consumer downstream can be tested with a plain object.
 */
export interface Alt1Host {
  rsX: number;
  rsY: number;
  rsWidth: number;
  rsHeight: number;
  rsScaling: number;
  rsLinked: boolean;
}

export type RsGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  scaling: number;
};

export function readGeometry(host: Alt1Host): RsGeometry | null {
  if (!host.rsLinked) return null;
  return {
    x: host.rsX,
    y: host.rsY,
    width: host.rsWidth,
    height: host.rsHeight,
    scaling: host.rsScaling,
  };
}

/**
 * Detects RS client resize / UI-scale changes by polling.
 *
 * Alt1 has no resize event -- its nine event types are alt1pressed, menudetected,
 * rslinked, rsunlinked, permissionchanged, daemonrun, userevent, rsfocus and
 * rsblur. Polling is therefore the only way to notice, and noticing is what lets
 * readers re-anchor instead of silently reading a stale rectangle forever.
 *
 * Position (x/y) is deliberately excluded from the comparison: reader coordinates
 * are RS-client-relative, so moving the window changes nothing and re-finding on
 * move would be pure waste.
 */
export class GeometryWatch {
  current: RsGeometry | null = null;
  #seen = false;

  constructor(private readonly host: Alt1Host) {}

  /** Returns true when the geometry changed since the previous call. */
  poll(): boolean {
    const next = readGeometry(this.host);
    const prev = this.current;

    const changed =
      !this.#seen ||
      (next === null) !== (prev === null) ||
      (next !== null &&
        prev !== null &&
        (next.width !== prev.width ||
          next.height !== prev.height ||
          next.scaling !== prev.scaling));

    this.#seen = true;
    this.current = next;
    return changed;
  }
}
