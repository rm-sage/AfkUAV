import { describe, expect, it } from "vitest";
import {
  DEFAULT_TONE,
  TONES,
  isBuiltinTone,
  parseUploadRef,
  resolveTone,
  toneDurationMs,
} from "~/alerting/tones";

describe("parseUploadRef", () => {
  // Real refs from an exported AfkWarden config.
  it("parses AfkWarden custom sound refs", () => {
    expect(parseUploadRef("upload:em2pm:Lobby timer")).toEqual({
      id: "em2pm",
      label: "Lobby timer",
    });
  });

  it("keeps labels containing spaces and punctuation", () => {
    expect(parseUploadRef("upload:eqg49:Taking_a loud sip of a drink")).toEqual({
      id: "eqg49",
      label: "Taking_a loud sip of a drink",
    });
  });

  it("returns null for built-in names", () => {
    expect(parseUploadRef("elevator")).toBeNull();
    expect(parseUploadRef("notification2")).toBeNull();
  });

  it("returns null for malformed refs", () => {
    expect(parseUploadRef("upload:")).toBeNull();
    expect(parseUploadRef("upload")).toBeNull();
  });
});

describe("resolveTone", () => {
  it("resolves the built-ins that appear in real configs", () => {
    for (const name of ["elevator", "notification2", "alarm"]) {
      expect(isBuiltinTone(name)).toBe(true);
      expect(resolveTone(name)).toBe(TONES[name]);
    }
  });

  // An unknown sound must still make a noise. Silence would look identical to a
  // broken alert.
  it("falls back to a default tone rather than silence", () => {
    expect(resolveTone("something-that-does-not-exist")).toBe(TONES[DEFAULT_TONE]);
    expect(resolveTone("upload:em2pm:Lobby timer")).toBe(TONES[DEFAULT_TONE]);
  });

  it("reports unknown names as non-builtin", () => {
    expect(isBuiltinTone("nope")).toBe(false);
  });
});

describe("tone specs", () => {
  it("every tone has audible content and a repeat gap", () => {
    for (const [name, spec] of Object.entries(TONES)) {
      expect(spec.steps.length, name).toBeGreaterThan(0);
      expect(toneDurationMs(spec), name).toBeGreaterThan(0);
      expect(spec.repeatGapMs, name).toBeGreaterThan(0);
      expect(spec.steps.some((s) => s.freq > 0), name).toBe(true);
    }
  });

  it("the default tone exists", () => {
    expect(TONES[DEFAULT_TONE]).toBeDefined();
  });
});
