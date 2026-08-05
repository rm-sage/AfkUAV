export type AnchorState = "searching" | "ok" | "lost";

export type AnchorHealth = {
  state: AnchorState;
  foundAtTick: number | null;
  emptyReads: number;
  findAttempts: number;
  lastInvalidation: string | null;
};

export type ReaderAnchorOptions<T> = {
  find: () => T | null;
  /** Backstop re-find interval. 500 ticks is ~5 minutes at 600ms. */
  ttlTicks?: number;
  /** Consecutive empty reads before assuming the position went stale. */
  maxEmptyReads?: number;
};

/**
 * Owns a reader's screen position and decides when that position is stale.
 *
 * This class is the fix for the defect that makes AfkWarden intermittently
 * unusable. Every one of its readers is guarded by
 *
 *     if (reader.pos) { return; }        // or: if (!this.reader.pos) this.reader.find();
 *
 * and nothing in the entire application ever assigns `.pos` back to null. There is
 * no TTL, no invalidation on failed reads, no rslinked handler and no rsWidth
 * polling. So each reader locates the chatbox or buff bar exactly once per session
 * and reads that fixed rectangle forever: resize the window or change UI scale and
 * every dependent alert silently reads the wrong region until the app is restarted.
 *
 * Here a position is a lease rather than a fact. It expires on explicit
 * invalidation (geometry change, rslinked), after enough consecutive empty reads to
 * suggest the target moved, or on a TTL backstop. Re-finding costs milliseconds; a
 * silently dead alert costs the thing you were AFK for.
 */
export class ReaderAnchor<T> {
  #pos: T | null = null;
  #foundAtTick: number | null = null;
  #lastAttemptTick = -1;
  #emptyReads = 0;
  #findAttempts = 0;
  #lastInvalidation: string | null = null;
  #state: AnchorState = "searching";

  readonly #find: () => T | null;
  readonly #ttlTicks: number;
  readonly #maxEmptyReads: number;

  constructor(opts: ReaderAnchorOptions<T>) {
    this.#find = opts.find;
    this.#ttlTicks = opts.ttlTicks ?? 500;
    this.#maxEmptyReads = opts.maxEmptyReads ?? 10;
  }

  get health(): AnchorHealth {
    return {
      state: this.#state,
      foundAtTick: this.#foundAtTick,
      emptyReads: this.#emptyReads,
      findAttempts: this.#findAttempts,
      lastInvalidation: this.#lastInvalidation,
    };
  }

  /** Drop the cached position. `reason` surfaces in health for diagnostics. */
  invalidate(reason: string): void {
    if (this.#pos !== null) this.#lastInvalidation = reason;
    this.#pos = null;
    this.#foundAtTick = null;
    this.#emptyReads = 0;
  }

  /**
   * Feed read outcomes back in so the anchor can self-heal without any external
   * signal. A reader that keeps returning nothing is usually pointed at the wrong
   * place, not looking at a genuinely empty screen.
   */
  reportRead(producedData: boolean): void {
    if (producedData) {
      this.#emptyReads = 0;
      return;
    }
    this.#emptyReads++;
    if (this.#emptyReads >= this.#maxEmptyReads) {
      this.invalidate("empty-reads");
    }
  }

  get(tick: number): T | null {
    if (
      this.#pos !== null &&
      this.#foundAtTick !== null &&
      tick - this.#foundAtTick >= this.#ttlTicks
    ) {
      this.invalidate("ttl");
    }

    if (this.#pos !== null) return this.#pos;

    // At most one find attempt per tick. Searching is comparatively expensive and a
    // genuinely absent target (game closed, interface hidden) must not burn the
    // frame budget retrying within a single tick.
    if (tick === this.#lastAttemptTick) return null;
    this.#lastAttemptTick = tick;
    this.#findAttempts++;

    const found = this.#find();
    if (found === null) {
      this.#state = "lost";
      return null;
    }

    this.#pos = found;
    this.#foundAtTick = tick;
    this.#state = "ok";
    return found;
  }
}
