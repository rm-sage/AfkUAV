import { useEffect, useRef } from "preact/hooks";
import type { Settings } from "~/store/schema";
import { TONES } from "~/alerting/tones";
import { isSupported as speechSupported } from "~/alerting/speech";

export type SettingsDialogProps = {
  open: boolean;
  settings: Settings;
  onChange(next: Settings): void;
  onClose(): void;
};

const SOUND_OPTIONS = Object.entries(TONES).map(([value, spec]) => ({ value, label: spec.label }));

export function SettingsDialog({ open, settings, onChange, onClose }: SettingsDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d === null) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]): void => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <dialog ref={ref} onCancel={onClose}>
      <h2>Settings</h2>

      <h3 class="dlg__section">Sound</h3>

      <div class="fld">
        <label class="fld__label">Volume</label>
        <div class="fld__row">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.volume}
            disabled={settings.muted}
            onInput={(e) => set("volume", Number((e.target as HTMLInputElement).value))}
          />
          <span class="fld__suffix">{Math.round(settings.volume * 100)}%</span>
        </div>
      </div>

      <div class="fld fld--check">
        <label>
          <input
            type="checkbox"
            checked={settings.muted}
            onChange={(e) => set("muted", (e.target as HTMLInputElement).checked)}
          />
          Mute everything
        </label>
      </div>

      <div class="fld">
        <label class="fld__label">Global alarm sound</label>
        <div class="fld__row">
          <select
            value={settings.globalAlarm?.sound ?? ""}
            onChange={(e) => {
              const v = (e.target as HTMLSelectElement).value;
              set(
                "globalAlarm",
                v.length === 0
                  ? null
                  : { sound: v, repeat: settings.globalAlarm?.repeat ?? false },
              );
            }}
          >
            <option value="">None</option>
            {SOUND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <label class="fld__inline">
            <input
              type="checkbox"
              disabled={settings.globalAlarm === null}
              checked={settings.globalAlarm?.repeat === true}
              onChange={(e) =>
                set(
                  "globalAlarm",
                  settings.globalAlarm === null
                    ? null
                    : { ...settings.globalAlarm, repeat: (e.target as HTMLInputElement).checked },
                )
              }
            />
            Repeat
          </label>
        </div>
        <p class="fld__help">
          Used by any alert set to "use the global alarm" — which is most of them.
        </p>
      </div>

      <div class="fld fld--check">
        <label>
          <input
            type="checkbox"
            checked={settings.activeSuppress}
            onChange={(e) => set("activeSuppress", (e.target as HTMLInputElement).checked)}
          />
          Stay quiet while you are playing
        </label>
        <p class="fld__help">
          Suppresses alarms for a few seconds after you click, so acting on one alert does not
          set off another.
        </p>
      </div>

      <h3 class="dlg__section">Display</h3>

      <div class="fld fld--check">
        <label>
          <input
            type="checkbox"
            checked={settings.showTaskbarOverlay}
            onChange={(e) => set("showTaskbarOverlay", (e.target as HTMLInputElement).checked)}
          />
          Show countdown on the RuneScape taskbar icon
        </label>
        <p class="fld__help">
          Draws a progress bar over the taskbar icon showing time until you have to click. Only
          alerts with "show on taskbar" enabled contribute.
        </p>
      </div>

      {!speechSupported() ? (
        <p class="fld__help fld__help--warn">
          Text-to-speech is unavailable in this browser, so spoken alerts will stay silent.
        </p>
      ) : null}

      <div class="dlg__actions">
        <button class="btn" onClick={onClose}>
          Done
        </button>
      </div>
    </dialog>
  );
}
