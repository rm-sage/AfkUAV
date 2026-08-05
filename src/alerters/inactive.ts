import { z } from "zod";
import { clamp01, defineAlerter, type AlerterContext, type TriggerState } from "~/engine/types";

export const InactiveVars = z.object({
  /** Seconds of no RS interaction before triggering. AfkWarden's lobby default is 570. */
  delay: z.number().int().positive().default(570),
});

export type InactiveVars = z.infer<typeof InactiveVars>;

/**
 * Triggers when the RS window has not been clicked for `delay` seconds.
 *
 * The canonical use is the lobby timer: RuneScape disconnects an idle client, so
 * this fires just before that happens.
 */
export const inactiveAlerter = defineAlerter<InactiveVars>({
  type: "inactive",
  typename: "Inactive",
  descr:
    "Triggers when you have not clicked the RuneScape window for a set amount of time.",
  schema: InactiveVars,
  create(vars) {
    return {
      check(ctx: AlerterContext): TriggerState {
        // Without Gamestate, idleMs carries no information. Say so rather than
        // reporting a confident "not idle" that would never fire.
        if (!ctx.hasGameState) {
          return { triggered: false, bar: 0, functional: false };
        }

        const targetMs = vars.delay * 1000;
        return {
          triggered: ctx.idleMs >= targetMs,
          bar: clamp01(ctx.idleMs / targetMs),
          functional: true,
        };
      },
    };
  },
});
