import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { AlerterBaseSchema, type AlerterBase } from "~/store/schema";
import { getAlerterModule, implementedModules } from "~/engine/registry";
import { KNOWN_ALERTER_TYPES } from "~/engine/known-types";
import { TONES } from "~/alerting/tones";
import { FieldEditor } from "~/ui/FieldEditor";

export type AlertEditorProps = {
  /** The alert being edited, or null when creating a new one. */
  alert: AlerterBase | null;
  open: boolean;
  groups: string[];
  onSave(next: AlerterBase): void;
  onDelete(): void;
  onClose(): void;
};

const SOUND_OPTIONS = Object.entries(TONES).map(([value, spec]) => ({
  value,
  label: spec.label,
}));

function blankAlert(type: string): AlerterBase {
  const module = getAlerterModule(type);
  const vars = module === undefined ? {} : (module.schema.parse({}) as Record<string, unknown>);
  return AlerterBaseSchema.parse({ name: "New alert", type, vars });
}

export function AlertEditor(props: AlertEditorProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const creating = props.alert === null;
  const [draft, setDraft] = useState<AlerterBase>(() => props.alert ?? blankAlert("inactive"));

  useEffect(() => {
    if (props.open) setDraft(props.alert ?? blankAlert("inactive"));
  }, [props.open, props.alert]);

  useEffect(() => {
    const d = ref.current;
    if (d === null) return;
    if (props.open && !d.open) d.showModal();
    if (!props.open && d.open) d.close();
  }, [props.open]);

  const module = useMemo(() => getAlerterModule(draft.type), [draft.type]);

  const setVar = (key: string, value: unknown): void => {
    setDraft((d) => ({ ...d, vars: { ...d.vars, [key]: value } }));
  };

  const save = (): void => {
    // Validate the type-specific settings before accepting, so a bad value is
    // caught here rather than surfacing later as a dead alert.
    if (module !== undefined) {
      const parsed = module.schema.safeParse(draft.vars);
      if (!parsed.success) return;
      props.onSave({ ...draft, vars: parsed.data as Record<string, unknown> });
      return;
    }
    props.onSave(draft);
  };

  const varsValid =
    module === undefined || module.schema.safeParse(draft.vars).success;

  return (
    <dialog ref={ref} class="dlg--wide" onCancel={props.onClose}>
      <h2>{creating ? "New alert" : "Edit alert"}</h2>

      <div class="fld">
        <label class="fld__label">Name</label>
        <input
          type="text"
          value={draft.name}
          onInput={(e) => setDraft({ ...draft, name: (e.target as HTMLInputElement).value })}
        />
      </div>

      {creating ? (
        <div class="fld">
          <label class="fld__label">Type</label>
          <select
            value={draft.type}
            onChange={(e) => setDraft(blankAlert((e.target as HTMLSelectElement).value))}
          >
            {implementedModules().map((m) => (
              <option key={m.type} value={m.type}>
                {m.typename}
              </option>
            ))}
          </select>
          <p class="fld__help">{module?.descr ?? ""}</p>
        </div>
      ) : (
        <div class="fld">
          <label class="fld__label">Type</label>
          <p class="fld__help">
            {module?.typename ?? draft.type}
            {module === undefined && KNOWN_ALERTER_TYPES.has(draft.type)
              ? " — not implemented yet, so this alert will not run."
              : ""}
          </p>
        </div>
      )}

      <div class="fld">
        <label class="fld__label">Group</label>
        <input
          type="text"
          list="afkuav-groups"
          value={draft.group ?? ""}
          placeholder="Optional section heading"
          onInput={(e) => {
            const v = (e.target as HTMLInputElement).value.trim();
            setDraft({ ...draft, group: v.length > 0 ? v : null });
          }}
        />
        <datalist id="afkuav-groups">
          {props.groups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </div>

      {module?.fields.map((spec) => (
        <FieldEditor
          key={spec.key}
          spec={spec}
          value={draft.vars[spec.key]}
          onChange={(v) => setVar(spec.key, v)}
        />
      ))}

      <hr class="dlg__rule" />

      <div class="fld fld--check">
        <label>
          <input
            type="checkbox"
            checked={draft.globalalarm}
            onChange={(e) =>
              setDraft({ ...draft, globalalarm: (e.target as HTMLInputElement).checked })
            }
          />
          Use the global alarm sound
        </label>
      </div>

      <div class="fld">
        <label class="fld__label">Own alarm sound</label>
        <div class="fld__row">
          <select
            value={draft.alarm?.sound ?? ""}
            onChange={(e) => {
              const v = (e.target as HTMLSelectElement).value;
              setDraft({
                ...draft,
                alarm: v.length === 0 ? null : { sound: v, repeat: draft.alarm?.repeat ?? false },
              });
            }}
          >
            <option value="">None</option>
            {SOUND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
            {draft.alarm !== null && !Object.hasOwn(TONES, draft.alarm.sound) ? (
              <option value={draft.alarm.sound}>{draft.alarm.sound} (imported)</option>
            ) : null}
          </select>
          <label class="fld__inline">
            <input
              type="checkbox"
              disabled={draft.alarm === null}
              checked={draft.alarm?.repeat === true}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  alarm:
                    draft.alarm === null
                      ? null
                      : { ...draft.alarm, repeat: (e.target as HTMLInputElement).checked },
                })
              }
            />
            Repeat
          </label>
        </div>
      </div>

      <div class="fld">
        <label class="fld__label">Spoken text</label>
        <input
          type="text"
          value={draft.voice?.text ?? ""}
          placeholder="Leave empty for no speech"
          onInput={(e) => {
            const text = (e.target as HTMLInputElement).value;
            setDraft({
              ...draft,
              voice:
                text.length === 0
                  ? null
                  : { text, speed: draft.voice?.speed ?? 175, pitch: draft.voice?.pitch ?? 50 },
            });
          }}
        />
      </div>

      <div class="fld">
        <label class="fld__label">Tooltip</label>
        <input
          type="text"
          value={draft.tooltip ?? ""}
          placeholder="Shown next to the cursor while firing"
          onInput={(e) => {
            const v = (e.target as HTMLInputElement).value;
            setDraft({ ...draft, tooltip: v.length > 0 ? v : null });
          }}
        />
      </div>

      <div class="fld fld--check">
        <label>
          <input
            type="checkbox"
            checked={draft.exportbar}
            onChange={(e) =>
              setDraft({ ...draft, exportbar: (e.target as HTMLInputElement).checked })
            }
          />
          Show this alert's countdown on the taskbar
        </label>
      </div>

      <div class="dlg__actions">
        {!creating ? (
          <button class="btn btn--danger" onClick={props.onDelete}>
            Delete
          </button>
        ) : null}
        <span class="ftr__spacer" />
        <button class="btn btn--ghost" onClick={props.onClose}>
          Cancel
        </button>
        <button class="btn" onClick={save} disabled={!varsValid || draft.name.trim().length === 0}>
          {creating ? "Add" : "Save"}
        </button>
      </div>
    </dialog>
  );
}
