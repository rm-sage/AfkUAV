import { PresetSchema, type Preset } from "~/store/schema";
import { KNOWN_ALERTER_TYPES } from "~/engine/known-types";

export type ImportIssue = { path: string; message: string };

export type ImportResult =
  | { ok: true; presets: Preset[]; issues: ImportIssue[] }
  | { ok: false; issues: ImportIssue[] };

/** Fields AfkWarden stores on every alerter regardless of type. */
const COMMON_FIELDS = new Set([
  "name",
  "type",
  "globalalarm",
  "alarm",
  "voice",
  "tooltip",
  "exportbar",
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function looksLikePreset(v: unknown): v is Record<string, unknown> {
  return isRecord(v) && Array.isArray(v.alerters);
}

/**
 * Import AfkWarden configuration.
 *
 * Accepts all three shapes users can actually produce:
 *   - a single preset from AfkWarden's own Export button: `{alerters, name, baseName}`
 *   - the whole `afkscape_presets` localStorage map: `{ [name]: preset }`
 *   - an array of presets
 *
 * AfkWarden's own importer swallows bad input --
 * `if (!obj) { console.log("invalid import"); return; } //TODO feedback` -- so a
 * malformed paste produces no visible error at all. Everything here is reported.
 */
export function importAfkWarden(raw: unknown): ImportResult {
  const issues: ImportIssue[] = [];

  let candidates: Array<{ key: string; value: unknown }>;
  if (looksLikePreset(raw)) {
    candidates = [{ key: String(raw.name ?? "Imported"), value: raw }];
  } else if (Array.isArray(raw)) {
    candidates = raw.map((value, i) => ({ key: `[${i}]`, value }));
  } else if (isRecord(raw)) {
    candidates = Object.entries(raw).map(([key, value]) => ({ key, value }));
  } else {
    return {
      ok: false,
      issues: [{ path: "$", message: "Expected a preset object, a preset map, or an array of presets." }],
    };
  }

  const presets: Preset[] = [];
  for (const { key, value } of candidates) {
    if (!looksLikePreset(value)) {
      issues.push({ path: key, message: "Not a preset (no alerters array); skipped." });
      continue;
    }
    presets.push(convertPreset(key, value, issues));
  }

  if (presets.length === 0) {
    issues.push({ path: "$", message: "No presets found in the supplied data." });
    return { ok: false, issues };
  }

  return { ok: true, presets, issues };
}

export function importAfkWardenJson(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return {
      ok: false,
      issues: [{ path: "$", message: `Could not parse JSON: ${(e as Error).message}` }],
    };
  }
  return importAfkWarden(parsed);
}

function convertPreset(key: string, src: Record<string, unknown>, issues: ImportIssue[]): Preset {
  const name = typeof src.name === "string" && src.name.length > 0 ? src.name : key;
  const groups: string[] = [];
  const alerters: unknown[] = [];
  let currentGroup: string | null = null;

  for (const [i, rawAlerter] of (src.alerters as unknown[]).entries()) {
    const path = `${name}.alerters[${i}]`;

    if (!isRecord(rawAlerter)) {
      issues.push({ path, message: "Alerter is not an object; skipped." });
      continue;
    }

    // Chat alerters with no match lines can never fire. Users create them purely as
    // section headers, so promote them to real groups and attach what follows.
    const lines = rawAlerter.lines;
    if (rawAlerter.type === "chat" && Array.isArray(lines) && lines.length === 0) {
      const label = String(rawAlerter.name ?? "").trim();
      currentGroup = label.length > 0 ? label : null;
      if (currentGroup !== null && !groups.includes(currentGroup)) groups.push(currentGroup);
      continue;
    }

    const type = String(rawAlerter.type ?? "");
    if (!KNOWN_ALERTER_TYPES.has(type)) {
      issues.push({
        path,
        message: `Unknown alerter type "${type}" kept as-is; it will not run until supported.`,
      });
    }

    const vars: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rawAlerter)) {
      if (COMMON_FIELDS.has(k)) continue;
      // AfkWarden ships this misspelling throughout. Normalise on the way in; the
      // internal model never re-emits it.
      vars[k === "treshold" ? "threshold" : k] = v;
    }

    alerters.push({
      name: String(rawAlerter.name ?? ""),
      type,
      globalalarm: rawAlerter.globalalarm ?? true,
      alarm: rawAlerter.alarm ?? null,
      voice: rawAlerter.voice ?? null,
      tooltip: rawAlerter.tooltip ?? null,
      exportbar: rawAlerter.exportbar ?? false,
      group: currentGroup,
      vars,
    });
  }

  return PresetSchema.parse({
    name,
    baseName: typeof src.baseName === "string" ? src.baseName : "",
    groups,
    alerters,
  });
}
