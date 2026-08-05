import { describe, expect, it } from "vitest";
import { toAfkWardenPreset } from "~/import/export";
import { importAfkWarden } from "~/import/afkwarden";
import { PresetSchema } from "~/store/schema";

const preset = (alerters: unknown[], over: Record<string, unknown> = {}) =>
  PresetSchema.parse({ name: "P", baseName: "empty", alerters, ...over });

describe("toAfkWardenPreset", () => {
  it("flattens vars back to the top level", () => {
    const out = toAfkWardenPreset(
      preset([
        {
          name: "Seren spirit",
          type: "chat",
          vars: { lines: [{ text: "A Seren spirit appears", percent: 100 }], colors: [[0, 255, 255]] },
        },
      ]),
    );
    const a = out.alerters[0]!;
    expect(a.name).toBe("Seren spirit");
    expect(a.type).toBe("chat");
    expect(a.lines).toEqual([{ text: "A Seren spirit appears", percent: 100 }]);
    expect(a.colors).toEqual([[0, 255, 255]]);
    expect(a.vars).toBeUndefined();
  });

  // AfkWarden's own field name is misspelled; the export has to match or it will
  // not load there.
  it("restores the treshold misspelling", () => {
    const out = toAfkWardenPreset(
      preset([{ name: "HP", type: "actionbar", vars: { stat: "hp", threshold: 30 } }]),
    );
    expect(out.alerters[0]!.treshold).toBe(30);
    expect(out.alerters[0]!.threshold).toBeUndefined();
  });

  it("keeps the preset name and baseName", () => {
    const out = toAfkWardenPreset(preset([], { name: "Zuk", baseName: "slayer" }));
    expect(out).toMatchObject({ name: "Zuk", baseName: "slayer", alerters: [] });
  });

  it("re-emits groups as the empty chat alerters AfkWarden uses as headings", () => {
    const out = toAfkWardenPreset(
      preset([
        { name: "A", type: "inactive", group: "Waves", vars: { delay: 10 } },
        { name: "B", type: "inactive", group: "Waves", vars: { delay: 10 } },
      ]),
    );
    expect(out.alerters).toHaveLength(3);
    expect(out.alerters[0]).toMatchObject({ name: "Waves", type: "chat", lines: [] });
    expect(out.alerters[1]!.name).toBe("A");
  });

  it("emits one heading per group, not per alert", () => {
    const out = toAfkWardenPreset(
      preset([
        { name: "A", type: "inactive", group: "G1", vars: { delay: 1 } },
        { name: "B", type: "inactive", group: "G1", vars: { delay: 1 } },
        { name: "C", type: "inactive", group: "G2", vars: { delay: 1 } },
      ]),
    );
    expect(out.alerters.filter((a) => a.lines !== undefined)).toHaveLength(2);
  });

  it("emits no heading for ungrouped alerts", () => {
    const out = toAfkWardenPreset(preset([{ name: "A", type: "inactive", vars: { delay: 1 } }]));
    expect(out.alerters).toHaveLength(1);
  });
});

describe("export/import round trip", () => {
  it("survives a round trip through the importer", () => {
    const original = preset([
      { name: "Lobby timer", type: "inactive", exportbar: true, vars: { delay: 570 } },
      {
        name: "Seren spirit",
        type: "chat",
        group: "Spirits",
        vars: { lines: [{ text: "A Seren spirit appears", percent: 100 }], colors: [[0, 255, 255]] },
      },
    ]);

    const result = importAfkWarden(toAfkWardenPreset(original));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const back = result.presets[0]!;
    expect(back.name).toBe(original.name);
    expect(back.alerters).toHaveLength(2);
    expect(back.alerters[0]!.vars.delay).toBe(570);
    expect(back.alerters[0]!.exportbar).toBe(true);
    expect(back.alerters[1]!.group).toBe("Spirits");
    expect(back.groups).toContain("Spirits");
  });

  it("round-trips a renamed threshold", () => {
    const original = preset([
      { name: "HP", type: "actionbar", vars: { stat: "hp", higherlower: "lower", threshold: 30 } },
    ]);
    const result = importAfkWarden(toAfkWardenPreset(original));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.presets[0]!.alerters[0]!.vars.threshold).toBe(30);
  });
});
