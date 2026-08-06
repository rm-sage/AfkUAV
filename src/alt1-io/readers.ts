import * as abilityModule from "alt1/ability";
import * as buffsModule from "alt1/buffs";
import * as xpModule from "alt1/xpcounter";
import * as dialogModule from "alt1/dialog";
import * as targetModule from "alt1/targetmob";
import * as dropsModule from "alt1/dropsmenu";
import { interopDefault, interopNamed } from "~/alt1-io/interop";
import { captureRs } from "~/alt1-io/host";
import { AnchoredReader, type ReaderLike } from "~/readers/anchored-reader";
import type { ActionbarState, BuffSlot, DropEvent, TargetState } from "~/readers/bundle";
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

/**
 * One-shot read of the buff bar, for the capture picker.
 *
 * Uses a throwaway reader so the running one's cached position and state are
 * untouched by someone opening the editor.
 */
export function probeBuffs(debuffs: boolean): BuffSlot[] | null {
  try {
    const reader = makeBuffReader(debuffs);
    const img = captureRs();
    if (img === null) return null;
    if (reader.find(img) === null) return null;
    return reader.read(img);
  } catch {
    return null;
  }
}

export function buffReader(debuffs: boolean): AnchoredReader<unknown, BuffSlot[]> {
  return new AnchoredReader<unknown, BuffSlot[]>({
    make: () => makeBuffReader(debuffs),
    // An empty buff bar is a legitimate reading, not evidence of a bad position.
    isEmpty: () => false,
  });
}

type Alt1XpReader = {
  pos: unknown;
  skills: string[];
  values: number[];
  findAsync(cb?: unknown, img?: unknown): void;
  read(img?: unknown): unknown;
};

type XpReaderCtor = new () => Alt1XpReader;

export function makeXpReader(): ReaderLike<unknown, ReadonlyMap<string, number>> {
  const Ctor = interopDefault<XpReaderCtor>(xpModule);
  if (typeof Ctor !== "function") {
    throw new Error("alt1/xpcounter did not export XpcounterReader");
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
      // Unlike every other reader this one searches asynchronously, so the
      // position appears on a later tick. Returning null now simply means the
      // anchor tries again, which is exactly the behaviour we want.
      inner.findAsync(undefined, img);
      return inner.pos ?? null;
    },
    read(img: unknown) {
      inner.read(img);
      const out = new Map<string, number>();
      for (const [i, skill] of inner.skills.entries()) {
        const value = inner.values[i];
        if (typeof value === "number" && value >= 0) out.set(skill, value);
      }
      return out;
    },
  };
}

export function xpReader(): AnchoredReader<unknown, ReadonlyMap<string, number>> {
  return new AnchoredReader<unknown, ReadonlyMap<string, number>>({
    make: makeXpReader,
    isEmpty: (out) => out.size === 0,
  });
}

type Alt1DialogReader = {
  pos: unknown;
  find(img?: unknown): unknown;
  read(img?: unknown): unknown;
};

export function makeDialogReader(): ReaderLike<unknown, boolean> {
  const Ctor = interopDefault<new () => Alt1DialogReader>(dialogModule);
  if (typeof Ctor !== "function") throw new Error("alt1/dialog did not export DialogReader");
  const inner = new Ctor();

  return {
    get pos() {
      return inner.pos ?? null;
    },
    set pos(value: unknown) {
      inner.pos = value;
    },
    find(img: unknown) {
      inner.find(img);
      return inner.pos ?? null;
    },
    read(img: unknown) {
      // read() returns `false` for "no dialog" and an object when one is up, so
      // the boolean here is the answer rather than a truthiness accident.
      const out = inner.read(img);
      return out !== false && out !== null && out !== undefined;
    },
  };
}

export function dialogReader(): AnchoredReader<unknown, boolean> {
  return new AnchoredReader<unknown, boolean>({ make: makeDialogReader });
}

type Alt1TargetReader = { read(img?: unknown): TargetState | null };

/**
 * The target reader has no position to anchor — it searches the whole client
 * every read — so `find` reports a constant success and the anchor simply never
 * has anything to invalidate.
 */
export function makeTargetReader(): ReaderLike<unknown, TargetState | null> {
  const Ctor = interopDefault<new () => Alt1TargetReader>(targetModule);
  if (typeof Ctor !== "function") throw new Error("alt1/targetmob did not export TargetMobReader");
  const inner = new Ctor();
  const ANCHORLESS = {};

  return {
    pos: ANCHORLESS,
    find: () => ANCHORLESS,
    read(img: unknown) {
      return inner.read(img) ?? null;
    },
  };
}

export function targetReader(): AnchoredReader<unknown, TargetState | null> {
  return new AnchoredReader<unknown, TargetState | null>({ make: makeTargetReader });
}

type Alt1DropsReader = {
  pos: unknown;
  onincrease: ((name: string, increase: number, newtotal: number) => unknown) | null;
  find(img?: unknown): unknown;
  read(img?: unknown): unknown;
};

/**
 * The drops reader reports through a callback rather than a return value, so
 * increases are buffered as they fire and drained once per read.
 */
export function makeDropsReader(): ReaderLike<unknown, DropEvent[]> {
  const Ctor = interopDefault<new () => Alt1DropsReader>(dropsModule);
  if (typeof Ctor !== "function") throw new Error("alt1/dropsmenu did not export DropsMenuReader");
  const inner = new Ctor();

  let pending: DropEvent[] = [];
  inner.onincrease = (name: string, increase: number) => {
    pending.push({ name, amount: increase });
  };

  return {
    get pos() {
      return inner.pos ?? null;
    },
    set pos(value: unknown) {
      inner.pos = value;
    },
    find(img: unknown) {
      inner.find(img);
      return inner.pos ?? null;
    },
    read(img: unknown) {
      inner.read(img);
      const out = pending;
      pending = [];
      return out;
    },
  };
}

export function dropsReader(): AnchoredReader<unknown, DropEvent[]> {
  return new AnchoredReader<unknown, DropEvent[]>({
    make: makeDropsReader,
    // No drops is the normal state, not evidence of a bad position.
    isEmpty: () => false,
  });
}
