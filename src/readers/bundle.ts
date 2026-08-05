import type { Needle } from "~/readers/buff-match";
import type { AnchorHealth } from "~/readers/anchor";
import type { AnchoredReader } from "~/readers/anchored-reader";

/** Action bar resource levels, each 0..1. */
export type ActionbarState = {
  hp: number;
  pray: number;
  sum: number;
  dren: number;
};

export type BuffSlot = {
  /** The buff's icon, cropped for needle matching. */
  icon: Needle;
  /** Remaining seconds, or null when the timer text is unreadable. */
  timeLeft: number | null;
};

/**
 * What alerters may ask of the reader layer.
 *
 * Methods rather than fields so a tick that no alerter cares about costs nothing:
 * a preset with only chat alerts should never pay for OCR of the buff bar.
 * Results are memoized per tick, so ten buff alerts still read the bar once.
 */
export interface ReaderAccess {
  actionbar(): ActionbarState | null;
  buffs(): BuffSlot[] | null;
  debuffs(): BuffSlot[] | null;
  /** Current XP in a skill by AfkWarden's 3-letter code, or "total". */
  xp(skill: string): number | null;
  health(name: ReaderName): AnchorHealth | null;
}

export type ReaderName = "actionbar" | "buffs" | "debuffs" | "xp";

/** Reader access that always reports nothing. Used in tests and before Alt1 is present. */
export const NULL_READERS: ReaderAccess = {
  actionbar: () => null,
  buffs: () => null,
  debuffs: () => null,
  xp: () => null,
  health: () => null,
};

export type TickReaderSources = {
  actionbar?: AnchoredReader<unknown, ActionbarState>;
  buffs?: AnchoredReader<unknown, BuffSlot[]>;
  debuffs?: AnchoredReader<unknown, BuffSlot[]>;
  xp?: AnchoredReader<unknown, ReadonlyMap<string, number>>;
};

/**
 * Per-tick memoizing façade over the anchored readers.
 *
 * `beginTick` is called once by the loop with the shared capture; everything after
 * that is pull-based and cached, so ordering between alerters cannot change how
 * many reads happen.
 */
export class TickReaders implements ReaderAccess {
  #tick = 0;
  #img: unknown = null;
  #cache = new Map<string, unknown>();

  constructor(private readonly sources: TickReaderSources) {}

  beginTick(tick: number, img: unknown): void {
    this.#tick = tick;
    this.#img = img;
    this.#cache.clear();
  }

  invalidateAll(reason: string): void {
    for (const reader of Object.values(this.sources)) reader?.invalidate(reason);
  }

  #read<T>(key: string, reader: AnchoredReader<unknown, T> | undefined): T | null {
    if (reader === undefined || this.#img === null) return null;
    if (this.#cache.has(key)) return this.#cache.get(key) as T | null;
    const out = reader.update(this.#tick, this.#img);
    this.#cache.set(key, out);
    return out;
  }

  actionbar(): ActionbarState | null {
    return this.#read("actionbar", this.sources.actionbar);
  }

  buffs(): BuffSlot[] | null {
    return this.#read("buffs", this.sources.buffs);
  }

  debuffs(): BuffSlot[] | null {
    return this.#read("debuffs", this.sources.debuffs);
  }

  xp(skill: string): number | null {
    const table = this.#read("xp", this.sources.xp);
    if (table === null) return null;
    return table.get(skill) ?? null;
  }

  health(name: ReaderName): AnchorHealth | null {
    return this.sources[name]?.health ?? null;
  }
}
