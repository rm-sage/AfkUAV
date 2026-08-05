import * as abilityModule from "alt1/ability";
import { interopNamed } from "~/alt1-io/interop";
import { AnchoredReader, type ReaderLike } from "~/readers/anchored-reader";
import type { ActionbarState } from "~/readers/bundle";

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
