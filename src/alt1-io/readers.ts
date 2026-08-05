import * as abilityModule from "alt1/ability";
import * as buffsModule from "alt1/buffs";
import { interopDefault, interopNamed } from "~/alt1-io/interop";
import { AnchoredReader, type ReaderLike } from "~/readers/anchored-reader";
import type { ActionbarState, BuffSlot } from "~/readers/bundle";
import type { Needle } from "~/readers/buff-match";

/**
 * Factories that adapt alt1's readers to the plain `ReaderLike` shape.
 *
 * Two mismatches are bridged here rather than leaking upward:
 *  - alt1 readers report success from `find()` in inconsistent ways (boolean,
 *    position object, or null) while keeping the real position on `.pos`.
 *  - the packages are webpack UMD bundles, so named exports may sit one interop
 *    layer down.
 */

type Alt1ActionbarReader = {
  pos: unknown;
  find(img?: unknown): unknown;
  read(): { hp: number; dren: number; pray: number; sum: number };
};

type ActionbarCtor = new () => Alt1ActionbarReader;

export function makeActionbarReader(): ReaderLike<unknown, ActionbarState> {
  const Ctor = interopNamed<ActionbarCtor>(abilityModule, "ActionbarReader");
  if (Ctor === undefined) {
    throw new Error("alt1/ability did not export ActionbarReader");
  }
  const inner = new Ctor();

  return {
    get pos() {
      return inner.pos ?? null;
    },
    set pos(value: unknown) {
      inner.pos = value;
    },
    find(img: unknown) {
      // find() returns a boolean here; the position it establishes lives on .pos.
      inner.find(img);
      return inner.pos ?? null;
    },
    read() {
      const state = inner.read();
      if (state === null || state === undefined) return null;
      return { hp: state.hp, pray: state.pray, sum: state.sum, dren: state.dren };
    },
  };
}

export function actionbarReader(): AnchoredReader<unknown, ActionbarState> {
  return new AnchoredReader<unknown, ActionbarState>({ make: makeActionbarReader });
}

/** Icon size inside a buff cell: alt1's buffsize (27) minus its 1px border. */
const BUFF_ICON_SIZE = 25;

type Alt1Buff = {
  buffer: { width: number; height: number; data: Uint8ClampedArray };
  bufferx: number;
  buffery: number;
  readTime(): number;
};

type Alt1BuffReader = {
  pos: unknown;
  debuffs: boolean;
  find(img?: unknown): unknown;
  read(buffer?: unknown): Alt1Buff[] | null;
};

type BuffReaderCtor = new () => Alt1BuffReader;

/** Copy a square of RGBA out of a larger buffer. Returns null if out of bounds. */
function cropIcon(
  buffer: { width: number; height: number; data: Uint8ClampedArray },
  x: number,
  y: number,
  size: number,
): Needle | null {
  if (x < 0 || y < 0 || x + size > buffer.width || y + size > buffer.height) return null;

  const data = new Uint8ClampedArray(size * size * 4);
  for (let row = 0; row < size; row++) {
    const from = ((y + row) * buffer.width + x) * 4;
    data.set(buffer.data.subarray(from, from + size * 4), row * size * 4);
  }
  return { width: size, height: size, data };
}

export function makeBuffReader(debuffs: boolean): ReaderLike<unknown, BuffSlot[]> {
  const Ctor = interopDefault<BuffReaderCtor>(buffsModule);
  if (typeof Ctor !== "function") {
    throw new Error("alt1/buffs did not export BuffReader");
  }
  const inner = new Ctor();
  inner.debuffs = debuffs;

  return {
    get pos() {
      return inner.pos ?? null;
    },
    set pos(value: unknown) {
      inner.pos = value;
    },
    find(img: unknown) {
      // find() reports success as `true | null`; the position lives on .pos.
      inner.find(img);
      return inner.pos ?? null;
    },
    read() {
      const buffs = inner.read();
      if (buffs === null || buffs === undefined) return null;

      const slots: BuffSlot[] = [];
      for (const buff of buffs) {
        const icon = cropIcon(buff.buffer, buff.bufferx + 1, buff.buffery + 1, BUFF_ICON_SIZE);
        if (icon === null) continue;

        let timeLeft: number | null = null;
        try {
          const t = buff.readTime();
          timeLeft = typeof t === "number" && t >= 0 ? t : null;
        } catch {
          // Unreadable timer text is normal for buffs without a countdown.
        }
        slots.push({ icon, timeLeft });
      }
      return slots;
    },
  };
}

export function buffReader(debuffs: boolean): AnchoredReader<unknown, BuffSlot[]> {
  return new AnchoredReader<unknown, BuffSlot[]>({
    make: () => makeBuffReader(debuffs),
    // An empty buff bar is a legitimate reading, not evidence of a bad position.
    isEmpty: () => false,
  });
}
