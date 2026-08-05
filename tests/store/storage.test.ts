import { describe, expect, it } from "vitest";
import { MemoryStore, Store } from "~/store/storage";
import { DEFAULT_SETTINGS, PresetSchema, STORAGE_KEYS } from "~/store/schema";

function store() {
  const kv = new MemoryStore();
  return { kv, store: new Store(kv) };
}

const preset = (name: string) => PresetSchema.parse({ name, alerters: [] });

describe("Store presets", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(store().store.loadPresets()).toEqual([]);
  });

  it("round-trips presets", () => {
    const { store: s } = store();
    s.savePresets([preset("Mining"), preset("Zuk")]);
    expect(s.loadPresets().map((p) => p.name)).toEqual(["Mining", "Zuk"]);
  });

  it("survives corrupt JSON without throwing", () => {
    const { kv, store: s } = store();
    kv.setItem(STORAGE_KEYS.presets, "{ not json");
    expect(s.loadPresets()).toEqual([]);
  });

  // One bad preset must not cost the user every other preset.
  it("drops only the invalid entries", () => {
    const { kv, store: s } = store();
    kv.setItem(
      STORAGE_KEYS.presets,
      JSON.stringify([preset("Good"), { name: "", alerters: [] }, preset("AlsoGood")]),
    );
    expect(s.loadPresets().map((p) => p.name)).toEqual(["Good", "AlsoGood"]);
  });

  it("ignores a non-array payload", () => {
    const { kv, store: s } = store();
    kv.setItem(STORAGE_KEYS.presets, JSON.stringify({ nope: true }));
    expect(s.loadPresets()).toEqual([]);
  });
});

describe("Store settings", () => {
  it("falls back to defaults when absent", () => {
    expect(store().store.loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips settings", () => {
    const { store: s } = store();
    s.saveSettings({ ...DEFAULT_SETTINGS, volume: 0.25, muted: true });
    const out = s.loadSettings();
    expect(out.volume).toBe(0.25);
    expect(out.muted).toBe(true);
  });

  it("falls back to defaults on invalid stored settings", () => {
    const { kv, store: s } = store();
    kv.setItem(STORAGE_KEYS.settings, JSON.stringify({ volume: 99 }));
    expect(s.loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe("Store active preset", () => {
  it("round-trips and clears", () => {
    const { store: s } = store();
    expect(s.loadActivePresetName()).toBeNull();
    s.saveActivePresetName("Zuk");
    expect(s.loadActivePresetName()).toBe("Zuk");
    s.saveActivePresetName(null);
    expect(s.loadActivePresetName()).toBeNull();
  });
});
