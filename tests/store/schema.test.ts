import { describe, expect, it } from "vitest";
import {
  AlerterBaseSchema,
  DEFAULT_SETTINGS,
  PresetSchema,
  SettingsSchema,
  STORAGE_KEYS,
} from "~/store/schema";

describe("AlerterBaseSchema", () => {
  it("accepts a minimal alerter and applies defaults", () => {
    const r = AlerterBaseSchema.parse({ name: "Lobby timer", type: "inactive" });
    expect(r.globalalarm).toBe(true);
    expect(r.alarm).toBeNull();
    expect(r.voice).toBeNull();
    expect(r.tooltip).toBeNull();
    expect(r.exportbar).toBe(false);
    expect(r.paused).toBe(false);
    expect(r.group).toBeNull();
    expect(r.vars).toEqual({});
  });

  it("rejects an alerter with no type", () => {
    expect(() => AlerterBaseSchema.parse({ name: "x" })).toThrow();
  });

  it("accepts an alarm with a repeat flag", () => {
    const r = AlerterBaseSchema.parse({
      name: "x",
      type: "chat",
      alarm: { sound: "elevator", repeat: true },
    });
    expect(r.alarm).toEqual({ sound: "elevator", repeat: true });
  });

  it("accepts a voice spec within bounds and rejects out of range", () => {
    const ok = AlerterBaseSchema.parse({
      name: "x",
      type: "chat",
      voice: { text: "hi", speed: 175, pitch: 50 },
    });
    expect(ok.voice).toEqual({ text: "hi", speed: 175, pitch: 50 });

    expect(() =>
      AlerterBaseSchema.parse({
        name: "x",
        type: "chat",
        voice: { text: "hi", speed: 9999, pitch: 50 },
      }),
    ).toThrow();
  });

  it("carries arbitrary type-specific vars through untouched", () => {
    const r = AlerterBaseSchema.parse({
      name: "x",
      type: "chat",
      vars: { lines: [{ text: "a", percent: 100 }], colors: [[0, 255, 255]] },
    });
    expect(r.vars.lines).toEqual([{ text: "a", percent: 100 }]);
  });
});

describe("PresetSchema", () => {
  it("round-trips a preset", () => {
    const r = PresetSchema.parse({
      name: "Mining",
      alerters: [{ name: "Lobby timer", type: "inactive" }],
    });
    expect(r.name).toBe("Mining");
    expect(r.alerters).toHaveLength(1);
    expect(r.groups).toEqual([]);
    expect(r.baseName).toBe("");
  });

  it("rejects an unnamed preset", () => {
    expect(() => PresetSchema.parse({ name: "", alerters: [] })).toThrow();
  });
});

describe("SettingsSchema", () => {
  it("has usable defaults", () => {
    const s = SettingsSchema.parse({});
    expect(s).toEqual(DEFAULT_SETTINGS);
    expect(s.volume).toBeGreaterThan(0);
    expect(s.muted).toBe(false);
  });

  it("clamps volume to 0..1", () => {
    expect(() => SettingsSchema.parse({ volume: 1.5 })).toThrow();
    expect(() => SettingsSchema.parse({ volume: -0.1 })).toThrow();
  });
});

describe("STORAGE_KEYS", () => {
  // Origin is (scheme, host, port): every Alt1 plugin on one github.io account
  // shares a localStorage bucket, and an AfkWarden fork already squats afkscape_*.
  it("never collides with AfkWarden's keys", () => {
    for (const key of Object.values(STORAGE_KEYS)) {
      expect(key.startsWith("afkw2_")).toBe(true);
      expect(key.startsWith("afkscape_")).toBe(false);
    }
  });
});
