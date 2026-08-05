import { describe, expect, it } from "vitest";
import { importAfkWarden, importAfkWardenJson } from "~/import/afkwarden";

const chatAlerter = {
  name: "Seren spirit",
  globalalarm: true,
  alarm: null,
  voice: null,
  tooltip: null,
  exportbar: false,
  resetonactive: true,
  lines: [{ text: "A Seren spirit appears", percent: 100 }],
  colors: [[0, 255, 255]],
  type: "chat",
};

describe("importAfkWarden", () => {
  it("imports a single exported preset", () => {
    const r = importAfkWarden({
      name: "Woodcutting",
      baseName: "woodcutting",
      alerters: [chatAlerter],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.presets).toHaveLength(1);
    expect(r.presets[0]!.name).toBe("Woodcutting");
    expect(r.presets[0]!.baseName).toBe("woodcutting");
    expect(r.presets[0]!.alerters[0]!.type).toBe("chat");
  });

  it("imports the whole afkscape_presets map", () => {
    const r = importAfkWarden({
      Mining: { name: "Mining", baseName: "mining", alerters: [] },
      Woodcutting: { name: "Woodcutting", baseName: "woodcutting", alerters: [chatAlerter] },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.presets.map((p) => p.name).sort()).toEqual(["Mining", "Woodcutting"]);
  });

  it("imports an array of presets", () => {
    const r = importAfkWarden([{ name: "A", alerters: [] }, { name: "B", alerters: [] }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.presets).toHaveLength(2);
  });

  it("renames treshold to threshold", () => {
    const r = importAfkWarden({
      name: "P",
      alerters: [
        { name: "HP", type: "actionbar", stat: "hp", higherlower: "lower", treshold: 30 },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.presets[0]!.alerters[0]!.vars.threshold).toBe(30);
    expect(r.presets[0]!.alerters[0]!.vars.treshold).toBeUndefined();
  });

  it("moves type-specific fields into vars and keeps common fields at the top", () => {
    const r = importAfkWarden({ name: "P", alerters: [chatAlerter] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const a = r.presets[0]!.alerters[0]!;
    expect(a.name).toBe("Seren spirit");
    expect(a.globalalarm).toBe(true);
    expect(a.vars.lines).toEqual([{ text: "A Seren spirit appears", percent: 100 }]);
    expect(a.vars.colors).toEqual([[0, 255, 255]]);
    expect(a.vars.resetonactive).toBe(true);
    expect(a.vars.name).toBeUndefined();
    expect(a.vars.type).toBeUndefined();
  });

  it("converts an empty-lined chat alerter into a group header", () => {
    const header = "Pause all the below if using Elder Overload";
    const r = importAfkWarden({
      name: "Zuk",
      alerters: [{ name: header, type: "chat", lines: [], colors: [] }, chatAlerter],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = r.presets[0]!;
    expect(p.groups).toContain(header);
    expect(p.alerters).toHaveLength(1);
    expect(p.alerters[0]!.group).toBe(header);
  });

  it("keeps an unknown alerter type and records an issue", () => {
    const r = importAfkWarden({ name: "P", alerters: [{ name: "Odd", type: "notarealtype" }] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.presets[0]!.alerters).toHaveLength(1);
    expect(r.issues.some((i) => i.message.includes("notarealtype"))).toBe(true);
  });

  it("fails visibly on malformed input instead of silently", () => {
    expect(importAfkWarden(null).ok).toBe(false);
    expect(importAfkWarden(42).ok).toBe(false);
    expect(importAfkWarden("nope").ok).toBe(false);

    const r = importAfkWardenJson("{ not json");
    expect(r.ok).toBe(false);
    expect(r.issues[0]!.message).toMatch(/parse/i);
  });

  it("round-trips through JSON text", () => {
    const r = importAfkWardenJson(JSON.stringify({ name: "P", alerters: [chatAlerter] }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.presets[0]!.alerters[0]!.name).toBe("Seren spirit");
  });
});
