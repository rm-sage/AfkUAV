import { z } from "zod";
import { clamp01, defineAlerter, type AlerterContext, type TriggerState } from "~/engine/types";

const HOUR_MS = 60 * 60 * 1000;

export const CLOCK_MODES = {
  wfe: { label: "Wilderness flash events", intervalMs: HOUR_MS, durationMs: 5 * 60 * 1000 },
  divcache: { label: "Guthixian caches", intervalMs: HOUR_MS, durationMs: 5 * 60 * 1000 },
} as const;

export type ClockMode = keyof typeof CLOCK_MODES;

export const ClockBasedVars = z.object({
  mode: z.enum(["wfe", "divcache"]).default("wfe"),
  /** Seconds of warning before the event starts. Negative delays the alert. */
  offset: z.number().int().min(-60).max(600).default(0),
});

export type ClockBasedVars = z.infer<typeof ClockBasedVars>;

export type ClockWindow = {
  triggered: boolean;
  /** Milliseconds until the next window opens; 0 while one is open. */
  untilNextMs: number;
};

/**
 * Where `now` sits relative to a repeating event.
 *
 * Both supported events run on the hour for five minutes. Working in epoch
 * arithmetic rather than calendar fields keeps this immune to daylight-saving
 * shifts — the events are on a fixed cadence, not a local wall clock.
 */
export function clockWindow(now: number, mode: ClockMode, offsetSec: number): ClockWindow {
  const { intervalMs, durationMs } = CLOCK_MODES[mode];
  const warnMs = offsetSec * 1000;

  // Start of the current period, shifted so the warning lands before the event.
  const shifted = now + warnMs;
  const periodStart = Math.floor(shifted / intervalMs) * intervalMs;
  const sinceOpen = shifted - periodStart;

  // The window runs from `warnMs` before the event to the end of the event.
  const windowMs = warnMs + durationMs;
  if (sinceOpen < windowMs) return { triggered: true, untilNextMs: 0 };

  return { triggered: false, untilNextMs: intervalMs - sinceOpen };
}

/**
 * Triggers on RuneScape's hourly events.
 *
 * Needs no screen reader at all — the events are on a fixed schedule, so this is
 * pure arithmetic and works even while the game is minimised.
 *
 * The progress bar counts down to the next event rather than sitting at zero,
 * which AfkWarden does not do and which makes the alert useful before it fires.
 */
export const clockBasedAlerter = defineAlerter<ClockBasedVars>({
  type: "clockbased",
  typename: "Periodic events",
  descr: "Triggers on hourly events: wilderness flash events and Guthixian caches.",
  schema: ClockBasedVars,
  fields: [
    {
      key: "mode",
      kind: "select",
      label: "Event",
      options: Object.entries(CLOCK_MODES).map(([value, m]) => ({ value, label: m.label })),
    },
    {
      key: "offset",
      kind: "number",
      label: "Warn before",
      min: -60,
      max: 600,
      suffix: "sec",
      help: "How long before the event starts to alert. The alert stays on for the event itself.",
    },
  ],
  create(vars) {
    return {
      check(ctx: AlerterContext): TriggerState {
        const { intervalMs } = CLOCK_MODES[vars.mode];
        const w = clockWindow(ctx.now, vars.mode, vars.offset);
        return {
          triggered: w.triggered,
          bar: w.triggered ? 1 : clamp01(1 - w.untilNextMs / intervalMs),
          functional: true,
        };
      },
    };
  },
});
