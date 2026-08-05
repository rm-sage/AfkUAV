/**
 * The 16 alerter types AfkWarden actually registers (`Alerter.ts:972-992`).
 *
 * Three further classes are implemented but commented out of that registry and so
 * do not ship: `artisansworkshop`, `overheadprogress` and `broadcasts`. Counting
 * class definitions rather than the registry yields 17 and is wrong.
 */
export const KNOWN_ALERTER_TYPES = new Set([
  "inactive",
  "xpcounter",
  "bigxp",
  "chat",
  "craftmenu",
  "drops",
  "buffs",
  "actionbar",
  "sheathe",
  "castlewars",
  "dialogtextsimple",
  "fightkiln",
  "targetdeath",
  "summoning",
  "clockbased",
  "necroritual",
]);

export type KnownAlerterType =
  | "inactive"
  | "xpcounter"
  | "bigxp"
  | "chat"
  | "craftmenu"
  | "drops"
  | "buffs"
  | "actionbar"
  | "sheathe"
  | "castlewars"
  | "dialogtextsimple"
  | "fightkiln"
  | "targetdeath"
  | "summoning"
  | "clockbased"
  | "necroritual";
