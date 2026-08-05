import { ReaderAnchor, type AnchorHealth } from "~/readers/anchor";

/**
 * The shape every alt1 reader shares: locate yourself once, then read repeatedly.
 *
 * Declared structurally rather than importing alt1's classes so the wrapper and
 * everything above it stays testable with plain fakes.
 */
export interface ReaderLike<TPos, TOut> {
  pos: TPos | null;
  find(img: unknown): TPos | null;
  read(img: unknown): TOut | null;
}

export type AnchoredReaderOptions<TPos, TOut> = {
  make: () => ReaderLike<TPos, TOut>;
  ttlTicks?: number;
  maxEmptyReads?: number;
  /** Treat a structurally-empty result (e.g. []) as a failed read. */
  isEmpty?: (out: TOut) => boolean;
};

/**
 * Wraps an alt1 reader so its screen position is a lease rather than a fact.
 *
 * Every reader in AfkWarden is guarded by `if (!reader.pos) reader.find()` and
 * nothing ever clears `.pos`, so one window resize leaves it reading a stale
 * rectangle for the rest of the session. Routing all readers through this class
 * means that bug cannot be reintroduced one alerter at a time.
 *
 * The reader itself is built lazily: constructing alt1 readers eagerly costs work
 * before RuneScape is even running, and turns a construction failure into a dead
 * app rather than one degraded alert.
 */
export class AnchoredReader<TPos, TOut> {
  readonly #make: () => ReaderLike<TPos, TOut>;
  readonly #anchor: ReaderAnchor<TPos>;
  readonly #isEmpty: (out: TOut) => boolean;
  #reader: ReaderLike<TPos, TOut> | null = null;
  #image: unknown = null;

  constructor(opts: AnchoredReaderOptions<TPos, TOut>) {
    this.#make = opts.make;
    this.#isEmpty = opts.isEmpty ?? (() => false);
    this.#anchor = new ReaderAnchor<TPos>({
      find: () => this.#instance().find(this.#image),
      ttlTicks: opts.ttlTicks,
      maxEmptyReads: opts.maxEmptyReads,
    });
  }

  #instance(): ReaderLike<TPos, TOut> {
    this.#reader ??= this.#make();
    return this.#reader;
  }

  get health(): AnchorHealth {
    return this.#anchor.health;
  }

  get found(): boolean {
    return this.#anchor.health.state === "ok";
  }

  invalidate(reason: string): void {
    this.#anchor.invalidate(reason);
  }

  /** Read from the tick's shared capture. Returns null when unavailable. */
  update(tick: number, img: unknown): TOut | null {
    this.#image = img;

    const pos = this.#anchor.get(tick);
    if (pos === null) return null;

    const reader = this.#instance();
    // find() reassigns `pos` on the reader; re-pin before every read so the
    // anchor stays the authority on position rather than the reader.
    reader.pos = pos;

    let out: TOut | null;
    try {
      out = reader.read(img);
    } catch {
      // A reader that throws is indistinguishable from one that sees nothing.
      out = null;
    }

    const produced = out !== null && !this.#isEmpty(out);
    this.#anchor.reportRead(produced);
    return out;
  }
}
