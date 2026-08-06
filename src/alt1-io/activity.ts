export type MousePoint = { x: number; y: number };

/**
 * Tracks how long the in-game cursor has sat still.
 *
 * RuneScape treats mouse movement over the client as activity, not just clicks,
 * but Alt1 only exposes a click-based idle time (`rsLastActive`). AfkWarden uses
 * that alone, so its lobby timer can fire while you have been moving the mouse the
 * whole time and the game does not consider you idle at all.
 *
 * `alt1.mousePosition` gives the cursor position whenever it is inside the client
 * (and -1 outside), so polling it recovers the missing signal.
 *
 * A reading of `null` (cursor outside the client) is compared like any other
 * value: moving out of the client counts as one movement, and while the cursor
 * stays outside, idle time keeps growing — which matches the game, since a cursor
 * outside the client is not hovering it either.
 */
export class MouseActivityWatch {
  #last: MousePoint | null = null;
  #seen = false;
  #lastMovedAt = 0;

  /**
   * @param isActive whether RuneScape is the foreground window. Required because
   *   `alt1.mousePosition` reports a position whenever the cursor is inside the
   *   client RECTANGLE, foreground or not — so moving the mouse across a window
   *   covering the game would otherwise read as hovering it. The game does not
   *   count that, and neither should this.
   */
  constructor(
    private readonly getPosition: () => MousePoint | null,
    private readonly now: () => number,
    private readonly isActive: () => boolean = () => true,
  ) {}

  poll(): void {
    const next = this.isActive() ? this.getPosition() : null;
    const moved =
      !this.#seen ||
      (next === null) !== (this.#last === null) ||
      (next !== null && this.#last !== null && (next.x !== this.#last.x || next.y !== this.#last.y));

    if (moved) this.#lastMovedAt = this.now();
    this.#seen = true;
    this.#last = next;
  }

  /** Milliseconds since the cursor last moved. Matches the units of `idleMs`. */
  get idleMs(): number {
    if (!this.#seen) return 0;
    return Math.max(0, this.now() - this.#lastMovedAt);
  }
}
