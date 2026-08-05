import type { AlerterBase, Preset } from "~/store/schema";

export type AfkWardenAlerter = Record<string, unknown>;
export type AfkWardenPreset = {
  name: string;
  baseName: string;
  alerters: AfkWardenAlerter[];
};

function toAfkWardenAlerter(a: AlerterBase): AfkWardenAlerter {
  const out: AfkWardenAlerter = {
    name: a.name,
    type: a.type,
    globalalarm: a.globalalarm,
    alarm: a.alarm,
    voice: a.voice,
    tooltip: a.tooltip,
    exportbar: a.exportbar,
  };
  for (const [k, v] of Object.entries(a.vars)) {
    // AfkWarden's own field name is misspelled; put it back on the way out so the
    // export is genuinely loadable there.
    out[k === "threshold" ? "treshold" : k] = v;
  }
  return out;
}

/**
 * Convert a preset to AfkWarden's export shape.
 *
 * Deliberately round-trippable: groups are re-emitted as the empty chat alerters
 * AfkWarden users create as section headings, since that is the only way it can
 * represent them. Exporting therefore loses nothing that AfkWarden could have
 * stored in the first place.
 */
export function toAfkWardenPreset(preset: Preset): AfkWardenPreset {
  const alerters: AfkWardenAlerter[] = [];
  let currentGroup: string | null = null;

  for (const a of preset.alerters) {
    if (a.group !== currentGroup) {
      currentGroup = a.group;
      if (currentGroup !== null) {
        alerters.push({
          name: currentGroup,
          type: "chat",
          globalalarm: false,
          alarm: null,
          voice: null,
          tooltip: null,
          exportbar: false,
          lines: [],
          colors: [],
          resetonactive: true,
        });
      }
    }
    alerters.push(toAfkWardenAlerter(a));
  }

  return { name: preset.name, baseName: preset.baseName, alerters };
}
