import type { GeometryWatch } from "~/alt1-io/geometry";
import type { ChatboxPool } from "~/readers/chatbox-pool";
import type { AnchorHealth } from "~/readers/anchor";
import { NULL_READERS, type TickReaders } from "~/readers/bundle";
import { getAlerterModule } from "~/engine/registry";
import type { AlerterBase } from "~/store/schema";
import {
  IDLE,
  type AlerterContext,
  type AlerterRuntime,
  type RGB,
  type TriggerState,
} from "~/engine/types";

export const TICK_MS = 600;

export type ActiveAlerter = {
  config: AlerterBase;
  runtime: AlerterRuntime | null;
  state: TriggerState;
  /** Master ticks between checks. */
  ticks: number;
  /** Set when the alerter's own check() threw, so one bad type cannot kill the loop. */
  error: string | null;
};

export type LoopDeps = {
  now: () => number;
  /** Milliseconds since the last RS click. A duration, not a timestamp. */
  idleMs: () => number;
  /** Milliseconds since the in-game cursor last moved. */
  mouseIdleMs: () => number;
  hasGameState: () => boolean;
  /** Screen readers other than chat. Defaults to reporting nothing. */
  readers?: TickReaders;
  geometry: GeometryWatch;
  /** Returns the single shared capture for this tick, or null when unavailable. */
  capture: () => unknown | null;
  chat: ChatboxPool;
};

/** Build a runtime for a stored alerter, or null when its type is unimplemented/invalid. */
export function instantiate(config: AlerterBase): ActiveAlerter {
  const module = getAlerterModule(config.type);
  if (module === undefined) {
    return {
      config,
      runtime: null,
      state: { triggered: false, bar: 0, functional: false },
      ticks: 1,
      error: `Alerter type "${config.type}" is not implemented yet.`,
    };
  }

  const parsed = module.schema.safeParse(config.vars);
  if (!parsed.success) {
    return {
      config,
      runtime: null,
      state: { triggered: false, bar: 0, functional: false },
      ticks: module.ticks ?? 1,
      error: `Invalid settings: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    };
  }

  return {
    config,
    runtime: module.create(parsed.data),
    state: { ...IDLE },
    ticks: module.ticks ?? 1,
    error: null,
  };
}

/**
 * The master tick.
 *
 * Takes exactly one screen capture per step and shares it with every reader --
 * capturing per reader is what makes naive multi-reader designs expensive.
 *
 * Crucially, a geometry change invalidates readers. AfkWarden never does this,
 * which is why a single window resize silently breaks every alert it owns until
 * the app is restarted.
 */
export class TickLoop {
  tick = 0;
  alerters: ActiveAlerter[] = [];

  constructor(private readonly deps: LoopDeps) {}

  setAlerters(configs: readonly AlerterBase[]): void {
    this.alerters = configs.map(instantiate);
  }

  /** Reader health, surfaced so the UI can show it rather than hiding it in a log. */
  get chatHealth(): AnchorHealth {
    return this.deps.chat.health;
  }

  get chatBoxCount(): number {
    return this.deps.chat.boxCount;
  }

  /** Colour union across every active chat alerter. Recomputed each tick by design. */
  #chatColors(): RGB[] {
    const out: RGB[] = [];
    const seen = new Set<string>();
    for (const a of this.alerters) {
      if (a.config.type !== "chat" || a.config.paused || a.runtime === null) continue;
      const colors = a.config.vars.colors;
      if (!Array.isArray(colors)) continue;
      for (const c of colors as RGB[]) {
        const key = `${c[0]},${c[1]},${c[2]}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(c);
      }
    }
    return out;
  }

  step(): void {
    this.tick++;

    if (this.deps.geometry.poll()) {
      // Resize or UI-scale change: every cached reader position is now suspect.
      this.deps.chat.invalidate("geometry-change");
      this.deps.readers?.invalidateAll("geometry-change");
    }

    const img = this.deps.capture();
    this.deps.readers?.beginTick(this.tick, img);
    const chatLines = img === null ? [] : this.deps.chat.update(this.tick, img, this.#chatColors());

    const ctx: AlerterContext = {
      tick: this.tick,
      now: this.deps.now(),
      idleMs: this.deps.idleMs(),
      mouseIdleMs: this.deps.mouseIdleMs(),
      hasGameState: this.deps.hasGameState(),
      chatLines,
      readers: this.deps.readers ?? NULL_READERS,
      geometry: this.deps.geometry.current,
    };

    for (const a of this.alerters) {
      if (a.runtime === null) continue;
      if (a.config.paused) {
        a.state = { triggered: false, bar: 0, functional: a.state.functional };
        continue;
      }
      if (this.tick % a.ticks !== 0) continue;

      try {
        a.state = a.runtime.check(ctx);
        a.error = null;
      } catch (e) {
        // One misbehaving alerter must not stop the other 107.
        a.error = (e as Error).message;
        a.state = { triggered: false, bar: 0, functional: false };
      }
    }
  }

  /** Alerters currently firing, in configured order. */
  triggered(): ActiveAlerter[] {
    return this.alerters.filter((a) => a.state.triggered);
  }
}
