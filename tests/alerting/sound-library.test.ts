import { describe, expect, it } from "vitest";
import { labelFromFilename, resolveSound, soundLabel } from "~/alerting/sound-library";

describe("soundLabel", () => {
  // The upload id points at runeapps.org and is useless here, but the label is
  // exactly the filename the user uploaded.
  it("extracts the label from an AfkWarden upload ref", () => {
    expect(soundLabel("upload:em2pm:Lobby timer")).toBe("Lobby timer");
    expect(soundLabel("upload:eqg49:Taking_a loud sip of a drink")).toBe(
      "Taking_a loud sip of a drink",
    );
  });

  it("passes built-in names through unchanged", () => {
    expect(soundLabel("elevator")).toBe("elevator");
  });
});

describe("labelFromFilename", () => {
  it("drops the extension so a file matches an imported label", () => {
    expect(labelFromFilename("Lobby timer.wav")).toBe("Lobby timer");
    expect(labelFromFilename("Seren Spirit.WAV")).toBe("Seren Spirit");
  });

  it("keeps dots inside the name", () => {
    expect(labelFromFilename("alert.v2.mp3")).toBe("alert.v2");
  });

  it("leaves an extensionless name alone", () => {
    expect(labelFromFilename("chime")).toBe("chime");
  });
});

describe("resolveSound", () => {
  // The real case: an imported alert referencing runeapps.org, reconnected to a
  // local file purely by matching the label.
  it("matches an imported upload ref to a supplied file", () => {
    const r = resolveSound("upload:em2pm:Lobby timer", new Set(["Lobby timer"]));
    expect(r).toEqual({ kind: "custom", name: "Lobby timer" });
  });

  it("reports an upload ref with no audio as missing rather than silent", () => {
    const r = resolveSound("upload:em2pm:Lobby timer", new Set());
    expect(r).toEqual({ kind: "missing", name: "Lobby timer" });
  });

  it("resolves built-in tones", () => {
    expect(resolveSound("elevator", new Set())).toEqual({ kind: "builtin", name: "elevator" });
  });

  // A user file named after a built-in wins: they supplied it deliberately.
  it("prefers a supplied file over a built-in of the same name", () => {
    expect(resolveSound("elevator", new Set(["elevator"]))).toEqual({
      kind: "custom",
      name: "elevator",
    });
  });

  it("reports an unknown name as missing", () => {
    expect(resolveSound("nonsense", new Set())).toEqual({ kind: "missing", name: "nonsense" });
  });
});
