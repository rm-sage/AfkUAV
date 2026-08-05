export type ToneStep = {
  /** Hz. 0 means a rest. */
  freq: number;
  ms: number;
  type?: OscillatorType;
};

export type ToneSpec = {
  label: string;
  steps: ToneStep[];
  /** Gap before repeating, when the alarm repeats. */
  repeatGapMs: number;
};

/**
 * Built-in alarms, synthesized rather than shipped as audio files.
 *
 * AfkWarden serves its built-in sounds from runeapps.org. Synthesizing keeps the
 * app fully offline and asset-free, and the names below match the ones that appear
 * in real AfkWarden configs so imported alerts keep working.
 */
export const TONES: Record<string, ToneSpec> = {
  elevator: {
    label: "Elevator",
    steps: [
      { freq: 880, ms: 140 },
      { freq: 0, ms: 60 },
      { freq: 1175, ms: 220 },
    ],
    repeatGapMs: 900,
  },
  alarm: {
    label: "Alarm",
    steps: [
      { freq: 1000, ms: 160, type: "square" },
      { freq: 0, ms: 90 },
      { freq: 1000, ms: 160, type: "square" },
      { freq: 0, ms: 90 },
      { freq: 1000, ms: 160, type: "square" },
    ],
    repeatGapMs: 500,
  },
  notification: {
    label: "Notification",
    steps: [
      { freq: 1318, ms: 90 },
      { freq: 0, ms: 40 },
      { freq: 1760, ms: 160 },
    ],
    repeatGapMs: 1200,
  },
  notification2: {
    label: "Notification 2",
    steps: [
      { freq: 1046, ms: 110 },
      { freq: 0, ms: 50 },
      { freq: 1568, ms: 110 },
      { freq: 0, ms: 50 },
      { freq: 2093, ms: 180 },
    ],
    repeatGapMs: 1200,
  },
  chime: {
    label: "Chime",
    steps: [
      { freq: 1568, ms: 300, type: "triangle" },
      { freq: 1046, ms: 420, type: "triangle" },
    ],
    repeatGapMs: 1500,
  },
  beep: {
    label: "Beep",
    steps: [{ freq: 880, ms: 120, type: "square" }],
    repeatGapMs: 700,
  },
  siren: {
    label: "Siren",
    steps: [
      { freq: 700, ms: 220, type: "sawtooth" },
      { freq: 1100, ms: 220, type: "sawtooth" },
      { freq: 700, ms: 220, type: "sawtooth" },
      { freq: 1100, ms: 220, type: "sawtooth" },
    ],
    repeatGapMs: 400,
  },
};

export const DEFAULT_TONE = "notification";

/** Custom sounds imported from AfkWarden look like `upload:<id>:<label>`. */
export function parseUploadRef(sound: string): { id: string; label: string } | null {
  const m = /^upload:(\w{3,8}):(.*)$/.exec(sound);
  if (m === null) return null;
  return { id: m[1]!, label: m[2]! };
}

/** Resolve a stored sound name to a built-in tone, falling back rather than failing silently. */
export function resolveTone(sound: string): ToneSpec {
  return TONES[sound] ?? TONES[DEFAULT_TONE]!;
}

export function isBuiltinTone(sound: string): boolean {
  return Object.hasOwn(TONES, sound);
}

export function toneDurationMs(spec: ToneSpec): number {
  return spec.steps.reduce((n, s) => n + s.ms, 0);
}
