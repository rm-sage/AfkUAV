import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { ActiveAlerter, TickLoop } from "~/engine/loop";
import type { Preset, Settings } from "~/store/schema";
import { importAfkWardenJson, type ImportIssue } from "~/import/afkwarden";
import type { AnchorHealth } from "~/readers/anchor";

export type AppProps = {
  loop: TickLoop;
  presets: Preset[];
  activePreset: string | null;
  settings: Settings;
  onSelectPreset(name: string): void;
  onImport(presets: Preset[]): void;
  onSettings(next: Settings): void;
  onTogglePause(index: number): void;
};

/** Re-render on a timer rather than pushing from the loop: simpler, and 5fps is plenty. */
function useRepaint(ms = 200): void {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

function HealthPill({ health, boxes }: { health: AnchorHealth; boxes: number }) {
  const label =
    health.state === "ok"
      ? `${boxes} chatbox${boxes === 1 ? "" : "es"}`
      : health.state === "lost"
        ? "no chatbox"
        : "searching";

  const title =
    health.state === "ok"
      ? `Monitoring ${boxes} chatbox${boxes === 1 ? "" : "es"}.` +
        (health.lastInvalidation ? ` Last re-anchored: ${health.lastInvalidation}.` : "")
      : "Looking for a chatbox. Open one in game if alerts are not firing.";

  return (
    <span class={`health health--${health.state}`} title={title}>
      <span class="health__dot" />
      {label}
    </span>
  );
}

function Row({ a, onTogglePause }: { a: ActiveAlerter; onTogglePause(): void }) {
  const cls = [
    "row",
    a.state.triggered ? "row--fired" : "",
    a.config.paused ? "row--paused" : "",
    a.error !== null ? "row--broken" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div class={cls} title={a.error ?? a.config.tooltip ?? a.config.name}>
      <div class="row__bar" style={{ width: `${Math.round(a.state.bar * 100)}%` }} />
      <span class="row__name">{a.config.name || "(unnamed)"}</span>
      <span class="row__side">
        {a.error !== null ? <span class="badge badge--err">!</span> : null}
        {a.error === null && !a.state.functional ? <span class="badge">idle</span> : null}
        <button
          class="iconbtn"
          onClick={onTogglePause}
          title={a.config.paused ? "Resume" : "Pause"}
          aria-label={a.config.paused ? "Resume" : "Pause"}
        >
          {a.config.paused ? "▶" : "❚❚"}
        </button>
      </span>
    </div>
  );
}

function ImportDialog({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose(): void;
  onImport(presets: Preset[]): void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState("");
  const [issues, setIssues] = useState<ImportIssue[]>([]);

  useEffect(() => {
    const d = ref.current;
    if (d === null) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const run = useCallback(() => {
    const result = importAfkWardenJson(text);
    setIssues(result.issues);
    // Unlike AfkWarden -- which logs "invalid import" to a console nobody has open
    // and otherwise does nothing -- failures stay on screen.
    if (result.ok) {
      onImport(result.presets);
      if (result.issues.length === 0) {
        setText("");
        onClose();
      }
    }
  }, [text, onImport, onClose]);

  return (
    <dialog ref={ref} onCancel={onClose}>
      <h2>Import from AfkWarden</h2>
      <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--text-dim)" }}>
        In AfkWarden, open the save icon, choose a preset and press Export, then paste it
        here. The whole <code>afkscape_presets</code> blob works too.
      </p>
      <textarea
        value={text}
        placeholder='{"name":"Mining","baseName":"mining","alerters":[...]}'
        onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
      />
      {issues.length > 0 ? (
        <ul class="issues">
          {issues.map((i, n) => (
            <li key={n}>
              <strong>{i.path}</strong> — {i.message}
            </li>
          ))}
        </ul>
      ) : null}
      <div class="dlg__actions">
        <button class="btn btn--ghost" onClick={onClose}>
          Cancel
        </button>
        <button class="btn" onClick={run} disabled={text.trim().length === 0}>
          Import
        </button>
      </div>
    </dialog>
  );
}

export function App(props: AppProps) {
  useRepaint();
  const [importOpen, setImportOpen] = useState(false);

  const { loop, presets, activePreset, settings } = props;

  // Preserve configured order while collecting rows under their group heading.
  const sections = useMemo(() => {
    const out: Array<{ group: string | null; items: Array<{ a: ActiveAlerter; i: number }> }> = [];
    loop.alerters.forEach((a, i) => {
      const g = a.config.group;
      const last = out[out.length - 1];
      if (last !== undefined && last.group === g) last.items.push({ a, i });
      else out.push({ group: g, items: [{ a, i }] });
    });
    return out;
  }, [loop.alerters, loop.alerters.length]);

  const anyAlerters = loop.alerters.length > 0;

  return (
    <>
      <header class="hdr">
        <select
          class="hdr__preset"
          value={activePreset ?? ""}
          onChange={(e) => props.onSelectPreset((e.target as HTMLSelectElement).value)}
          disabled={presets.length === 0}
        >
          {presets.length === 0 ? <option value="">No presets</option> : null}
          {presets.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
        <HealthPill health={props.loop.chatHealth} boxes={props.loop.chatBoxCount} />
      </header>

      <main class="list">
        {anyAlerters ? (
          sections.map((s, n) => (
            <>
              {s.group !== null ? <div class="group" key={`g${n}`}>{s.group}</div> : null}
              {s.items.map(({ a, i }) => (
                <Row key={i} a={a} onTogglePause={() => props.onTogglePause(i)} />
              ))}
            </>
          ))
        ) : (
          <div class="empty">
            <h2>No alerts yet</h2>
            <p>
              Bring your AfkWarden setup across — presets, alerts and all — or start a new
              one from scratch.
            </p>
            <button class="btn" onClick={() => setImportOpen(true)}>
              Import from AfkWarden
            </button>
          </div>
        )}
      </main>

      <footer class="ftr">
        <button class="iconbtn" onClick={() => setImportOpen(true)} title="Import from AfkWarden">
          ⭳
        </button>
        <button
          class="iconbtn"
          onClick={() => props.onSettings({ ...settings, muted: !settings.muted })}
          title={settings.muted ? "Unmute" : "Mute"}
        >
          {settings.muted ? "🔇" : "🔊"}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.volume}
          disabled={settings.muted}
          onInput={(e) =>
            props.onSettings({ ...settings, volume: Number((e.target as HTMLInputElement).value) })
          }
          title="Volume"
        />
        <span class="ftr__spacer" />
        <span title="Alerts currently firing">
          {loop.triggered().length}/{loop.alerters.length}
        </span>
      </footer>

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={props.onImport}
      />
    </>
  );
}
