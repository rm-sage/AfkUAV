export type MousePoint = { x: number; y: number };

/**
 * Whether hovering the client should count as activity right now.
 *
 * The problem: `alt1.mousePosition` reports a position whenever the cursor is
 * inside the client RECTANGLE, so a window covering the game produces hovers the
 * game never sees. Alt1 exposes no visibility or z-order API — `rsActive` (focus)
 * is the only window-state signal — so occlusion cannot be asked about directly.
 *
 * But RuneScape does count hovering while merely unfocused, and treating focus as
 * the test throws that away.
 *
 * The middle ground uses the screen capture as the visibility proof. Alt1's
 * default capture reads the screen, so a covering window lands in the capture and
 * the chatbox reader stops being able to locate its box. A chatbox that is
 * currently found is therefore live evidence that the game is genuinely on
 * screen, whether or not it holds focus.
 *
 * Degrades safely in both directions: with no chatbox open this falls back to
 * focus-only, which is the conservative answer, and the window between a game
 * being covered and the reader noticing is a few seconds — irrelevant against a
 * timer measured in minutes.
 */
export function hoverCountsAsActivity(rsFocused: boolean, chatboxFound: boolean): boolean {
  return rsFocused || chatboxFound;
}

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
   * @param canHover whether hovering should count right now — see
   *   `hoverCountsAsActivity`. Without it, a window covering the game produces
   *   hovers the game never sees, because `alt1.mousePosition` only tests the
   *   client rectangle.
   */
  constructor(
    private readonly getPosition: () => MousePoint | null,
    private readonly now: () => number,
    private readonly canHover: () => boolean = () => true,
  ) {}

  poll(): void {
    const next = this.canHover() ? this.getPosition() : null;
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
