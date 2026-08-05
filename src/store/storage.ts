import {
  DEFAULT_SETTINGS,
  PresetSchema,
  SettingsSchema,
  STORAGE_KEYS,
  type Preset,
  type Settings,
} from "~/store/schema";

/** Minimal Storage surface, injectable so tests need no DOM. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** In-memory fallback so the app still runs if localStorage is unavailable. */
export class MemoryStore implements KeyValueStore {
  #map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.#map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.#map.set(key, value);
  }
  removeItem(key: string): void {
    this.#map.delete(key);
  }
}

export function defaultStore(): KeyValueStore {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    /* Access can throw when storage is blocked. */
  }
  return new MemoryStore();
}

/**
 * Persistence for presets and settings.
 *
 * Keys are namespaced `afkw2_*`. Origin is (scheme, host, port), so every Alt1
 * plugin served from one github.io account shares a single localStorage bucket --
 * and AfkWarden forks already occupy `afkscape_presets` and friends. Reusing those
 * names would silently cross-contaminate two apps' configuration.
 */
export class Store {
  constructor(private readonly kv: KeyValueStore = defaultStore()) {}

  loadPresets(): Preset[] {
    const raw = this.kv.getItem(STORAGE_KEYS.presets);
    if (raw === null) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Drop only the entries that fail, never the whole file: one corrupt preset
      // must not cost the user every other preset they have.
      return parsed.flatMap((p) => {
        const r = PresetSchema.safeParse(p);
        return r.success ? [r.data] : [];
      });
    } catch {
      return [];
    }
  }

  savePresets(presets: readonly Preset[]): void {
    this.kv.setItem(STORAGE_KEYS.presets, JSON.stringify(presets));
  }

  loadSettings(): Settings {
    const raw = this.kv.getItem(STORAGE_KEYS.settings);
    if (raw === null) return { ...DEFAULT_SETTINGS };
    try {
      const r = SettingsSchema.safeParse(JSON.parse(raw));
      return r.success ? r.data : { ...DEFAULT_SETTINGS };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  saveSettings(settings: Settings): void {
    this.kv.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  }

  loadActivePresetName(): string | null {
    return this.kv.getItem(STORAGE_KEYS.activePreset);
  }

  saveActivePresetName(name: string | null): void {
    if (name === null) this.kv.removeItem(STORAGE_KEYS.activePreset);
    else this.kv.setItem(STORAGE_KEYS.activePreset, name);
  }
}
