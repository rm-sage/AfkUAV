import { z } from "zod";
import {
  defineAlerter,
  type AlerterContext,
  type ChatLine,
  type RGB,
  type TriggerState,
} from "~/engine/types";

const RGBSchema = z.tuple([z.number(), z.number(), z.number()]);

export const ChatVars = z.object({
  /** Any match fires the alert. `percent` is AfkWarden's confidence weight. */
  lines: z
    .array(z.object({ text: z.string(), percent: z.number().default(100) }))
    .default([]),
  /** Text colours to accept. Empty means accept any colour. */
  colors: z.array(RGBSchema).default([]),
  /** Clear the triggered state as soon as the player interacts with the game. */
  resetonactive: z.boolean().default(true),
});

export type ChatVars = z.infer<typeof ChatVars>;

function colorMatches(line: ChatLine, colors: readonly RGB[]): boolean {
  if (colors.length === 0) return true;
  return colors.some(
    (c) => c[0] === line.color[0] && c[1] === line.color[1] && c[2] === line.color[2],
  );
}

/**
 * Triggers when a monitored chatbox produces a line containing any configured text.
 *
 * Matching is a case-insensitive substring test, which is what AfkWarden does and
 * what existing presets are written against -- entries like
 * "has gained a level! It is now level 2" are deliberate fragments of a longer line.
 *
 * Colour filtering is an additional constraint, not the primary discriminator. In
 * real configs it discriminates very little: 20 of 33 chat alerters in one boss
 * preset share an identical 7-colour set, so text does effectively all the work.
 */
export const chatAlerter = defineAlerter<ChatVars>({
  type: "chat",
  typename: "Chatbox",
  descr: "Triggers when a chat message matching your text appears in any monitored chatbox.",
  schema: ChatVars,
  create(vars) {
    const needles = vars.lines
      .map((l) => l.text.toLowerCase())
      .filter((t) => t.length > 0);

    let triggered = false;
    let lastActive = -1;

    return {
      check(ctx: AlerterContext): TriggerState {
        // An alerter with no needles can never fire. The importer promotes those to
        // group headers, so reaching here means it was configured but left empty.
        if (needles.length === 0) {
          return { triggered: false, bar: 0, functional: false };
        }

        if (vars.resetonactive && triggered) {
          if (lastActive !== -1 && ctx.rsLastActive > lastActive) triggered = false;
        }
        lastActive = ctx.rsLastActive;

        for (const line of ctx.chatLines) {
          if (!colorMatches(line, vars.colors)) continue;
          const hay = line.text.toLowerCase();
          if (needles.some((n) => hay.includes(n))) {
            triggered = true;
            break;
          }
        }

        return { triggered, bar: triggered ? 1 : 0, functional: true };
      },
      reset() {
        triggered = false;
      },
    };
  },
});
