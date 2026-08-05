/**
 * Declarative description of an alerter's editable settings.
 *
 * Declared per module rather than derived from the zod schema. Introspecting zod
 * would couple the UI to library internals and still could not supply the thing
 * that matters most — human labels and units. AfkWarden's own labels ("Alert
 * after (sec)", "Minimum xp drop") are carried over so the editor reads familiar.
 */
export type SelectOption = { value: string; label: string };

export type FieldSpec =
  | { key: string; kind: "number"; label: string; min?: number; max?: number; step?: number; suffix?: string; help?: string }
  | { key: string; kind: "boolean"; label: string; help?: string }
  | { key: string; kind: "text"; label: string; placeholder?: string; help?: string }
  | { key: string; kind: "select"; label: string; options: SelectOption[]; help?: string }
  /** List of match strings, as the chat alerter uses. */
  | { key: string; kind: "lines"; label: string; help?: string }
  /** List of RGB triples. */
  | { key: string; kind: "colors"; label: string; help?: string }
  /** Captured buff icon, edited by re-capturing rather than by typing. */
  | { key: string; kind: "buffimage"; label: string; help?: string };

/** RuneScape skill codes as AfkWarden stores them. */
export const SKILL_OPTIONS: SelectOption[] = [
  { value: "tot", label: "Total" },
  { value: "com", label: "Combat" },
  { value: "att", label: "Attack" },
  { value: "def", label: "Defence" },
  { value: "str", label: "Strength" },
  { value: "con", label: "Constitution" },
  { value: "ran", label: "Ranged" },
  { value: "pra", label: "Prayer" },
  { value: "mag", label: "Magic" },
  { value: "coo", label: "Cooking" },
  { value: "woo", label: "Woodcutting" },
  { value: "fle", label: "Fletching" },
  { value: "fis", label: "Fishing" },
  { value: "fir", label: "Firemaking" },
  { value: "cra", label: "Crafting" },
  { value: "smi", label: "Smithing" },
  { value: "min", label: "Mining" },
  { value: "her", label: "Herblore" },
  { value: "agi", label: "Agility" },
  { value: "thi", label: "Thieving" },
  { value: "sla", label: "Slayer" },
  { value: "far", label: "Farming" },
  { value: "run", label: "Runecrafting" },
  { value: "hun", label: "Hunter" },
  { value: "cst", label: "Construction" },
  { value: "sum", label: "Summoning" },
  { value: "dun", label: "Dungeoneering" },
  { value: "div", label: "Divination" },
  { value: "inv", label: "Invention" },
  { value: "arc", label: "Archaeology" },
  { value: "nec", label: "Necromancy" },
];
