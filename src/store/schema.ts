import { z } from "zod";

export const AlarmSchema = z.object({
  /** Built-in name ("elevator"), or a local sound id. Never a remote URL. */
  sound: z.string().min(1),
  repeat: z.boolean().default(false),
});

export const VoiceSchema = z.object({
  text: z.string(),
  speed: z.number().min(50).max(500).default(175),
  pitch: z.number().min(0).max(100).default(50),
});

export const AlerterBaseSchema = z.object({
  name: z.string(),
  type: z.string().min(1),
  globalalarm: z.boolean().default(true),
  alarm: AlarmSchema.nullable().default(null),
  voice: VoiceSchema.nullable().default(null),
  tooltip: z.string().nullable().default(null),
  exportbar: z.boolean().default(false),
  paused: z.boolean().default(false),
  /**
   * Section header this alerter belongs to.
   *
   * AfkWarden has no grouping, so users create alerters with no match lines purely
   * as visual separators. With 33 alerters in a single boss preset that stops being
   * a quirk and starts being the only way to navigate. Groups are first-class here.
   */
  group: z.string().nullable().default(null),
  /** Type-specific fields, validated by the owning alerter module. */
  vars: z.record(z.string(), z.unknown()).default({}),
});

export const PresetSchema = z.object({
  name: z.string().min(1),
  baseName: z.string().default(""),
  groups: z.array(z.string()).default([]),
  alerters: z.array(AlerterBaseSchema).default([]),
});

export const SettingsSchema = z.object({
  activeSuppress: z.boolean().default(false),
  /**
   * Hold every alert while the player is on the login screen or in the lobby,
   * so a lobby timer does not fire at you while you are already in the lobby.
   */
  suppressWhenLoggedOut: z.boolean().default(true),
  globalAlarm: AlarmSchema.nullable().default({ sound: "elevator", repeat: false }),
  showTaskbarOverlay: z.boolean().default(true),
  volume: z.number().min(0).max(1).default(0.5),
  muted: z.boolean().default(false),
});

export type Alarm = z.infer<typeof AlarmSchema>;
export type Voice = z.infer<typeof VoiceSchema>;
export type AlerterBase = z.infer<typeof AlerterBaseSchema>;
export type Preset = z.infer<typeof PresetSchema>;
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({});

/**
 * Storage keys are namespaced and must never reuse AfkWarden's `afkscape_*`.
 * Origin is (scheme, host, port), so every Alt1 plugin served from one github.io
 * account shares a single localStorage bucket -- and at least one existing
 * AfkWarden fork already squats those exact key names.
 */
export const STORAGE_KEYS = {
  presets: "afkw2_presets",
  settings: "afkw2_settings",
  activePreset: "afkw2_active_preset",
  sounds: "afkw2_sounds",
} as const;
