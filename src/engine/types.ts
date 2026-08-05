import type { ZodType } from "zod";
import type { RsGeometry } from "~/alt1-io/geometry";

export type RGB = [number, number, number];

export type ChatLine = {
  text: string;
  color: RGB;
  /** Per-colour fragments of the line, as the chatbox reader splits them. */
  fragments: string[];
};

/**
 * Everything an alerter is allowed to see on a tick.
 *
 * Alerters receive data, never readers. That is what keeps all 16 of them testable
 * as pure functions without Alt1, a game client, or a screen.
 */
export interface AlerterContext {
  tick: number;
  /** Wall-clock ms, injected rather than read from Date.now() so tests control time. */
  now: number;
  /**
   * Milliseconds SINCE the last click in the RS window -- a DURATION, not a
   * timestamp. This mirrors `alt1.rsLastActive`, whose name reads like a timestamp
   * and is not one; treating it as an epoch value makes every inactivity alert fire
   * permanently. The name here says what the number actually is.
   *
   * Requires the Gamestate permission; see `hasGameState`.
   */
  idleMs: number;
  /** False when the Gamestate permission is missing, which makes `idleMs` meaningless. */
  hasGameState: boolean;
  /** Deduped union of new lines across every monitored chatbox this tick. */
  chatLines: readonly ChatLine[];
  geometry: RsGeometry | null;
}

export type TriggerState = {
  triggered: boolean;
  /** Progress toward triggering, 0..1. Drives the progress bar. */
  bar: number;
  /** False when the underlying reader cannot see what it needs. */
  functional: boolean;
};

export const IDLE: TriggerState = { triggered: false, bar: 0, functional: true };

export interface AlerterRuntime {
  check(ctx: AlerterContext): TriggerState;
  /** Called when the user acknowledges or the alerter resets. */
  reset?(): void;
}

export interface AlerterModule<TVars> {
  type: string;
  typename: string;
  descr: string;
  schema: ZodType<TVars>;
  /** How many master ticks between checks. 1 = every 600ms. */
  ticks?: number;
  create(vars: TVars): AlerterRuntime;
}

export function defineAlerter<TVars>(m: AlerterModule<TVars>): AlerterModule<TVars> {
  return m;
}

/** Clamp a raw ratio into the 0..1 range the progress bar expects. */
export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
