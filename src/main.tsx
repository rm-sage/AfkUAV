import { render } from "preact";
import { GeometryWatch } from "~/alt1-io/geometry";
import {
  captureRs,
  hasGameState,
  idleMs,
  identify,
  liveHost,
  makeChatboxReader,
  mixColor,
  mousePosition,
  rsFocused,
  setTooltip,
  taskbarSetter,
} from "~/alt1-io/host";
import { MouseActivityWatch } from "~/alt1-io/activity";
import { actionbarReader, buffReader, xpReader } from "~/alt1-io/readers";
import { TickReaders } from "~/readers/bundle";
import { AlarmScheduler } from "~/alerting/alarm";
import { SoundPlayer } from "~/alerting/player";
import { TaskbarBar, shouldSuppress, taskbarState } from "~/alerting/taskbar";
import { ChatboxPool } from "~/readers/chatbox-pool";
import { TICK_MS, TickLoop } from "~/engine/loop";
import { Store } from "~/store/storage";
import { PresetSchema, type AlerterBase, type Preset, type Settings } from "~/store/schema";
import { speak } from "~/alerting/speech";
import { App, type PresetAction } from "~/ui/App";
import "~/ui/styles.css";

identify();

const store = new Store();
let presets: Preset[] = store.loadPresets();
let settings: Settings = store.loadSettings();
let activeName: string | null = store.loadActivePresetName() ?? presets[0]?.name ?? null;

const chat = new ChatboxPool({ makeReader: makeChatboxReader, mixColor });
const mouse = new MouseActivityWatch(mousePosition, () => Date.now());
const readers = new TickReaders({
  actionbar: actionbarReader(),
  buffs: buffReader(false),
  debuffs: buffReader(true),
  xp: xpReader(),
});

const loop = new TickLoop({
  now: () => Date.now(),
  idleMs,
  mouseIdleMs: () => mouse.idleMs,
  hasGameState,
  readers,
  geometry: new GeometryWatch(liveHost),
  capture: captureRs,
  chat,
});

function activePreset(): Preset | null {
  return presets.find((p) => p.name === activeName) ?? null;
}

function applyPreset(): void {
  loop.setAlerters(activePreset()?.alerters ?? []);
  paint();
}

const alarms = new AlarmScheduler();
const player = new SoundPlayer();
const taskbar = new TaskbarBar(taskbarSetter());

// Leave the RuneScape taskbar icon undecorated when the app closes.
globalThis.addEventListener("beforeunload", () => {
  taskbar.clear();
  player.stopAll();
});

/** Alerts that were speaking last tick, so each transition speaks exactly once. */
const spoken = new Set<string>();

function dispatchAlerts(): void {
  const focused = rsFocused();
  // Suppression keys off how recently you clicked, not focus: alt-tabbing to read
  // something is not the same as having stopped playing.
  const quiet = shouldSuppress(settings.activeSuppress, idleMs(), focused);
  const suppressed = settings.muted || quiet;
  const tooltips: string[] = [];

  const sources = loop.alerters.map((a, i) => ({
    key: `${i}:${a.config.name}`,
    triggered: a.state.triggered,
    alarm: a.config.alarm,
    globalalarm: a.config.globalalarm,
  }));

  // `quiet` is passed as the suppression flag the scheduler already understands.
  player.apply(alarms.update(sources, settings, quiet));

  taskbar.apply(
    taskbarState(
      loop.alerters.map((a) => ({
        paused: a.config.paused,
        triggered: a.state.triggered,
        bar: a.state.bar,
        exportbar: a.config.exportbar,
      })),
      settings.showTaskbarOverlay,
    ),
  );

  loop.alerters.forEach((a, i) => {
    const key = `${i}:${a.config.name}`;
    if (!a.state.triggered) {
      spoken.delete(key);
      return;
    }
    if (a.config.tooltip !== null && a.config.tooltip.length > 0) tooltips.push(a.config.tooltip);
    if (spoken.has(key)) return;
    spoken.add(key);
    if (a.config.voice !== null && !suppressed) speak(a.config.voice, settings.volume);
  });

  setTooltip(tooltips.join(" · "));
}

function tick(): void {
  // Poll before stepping so alerters see this tick's movement, not last tick's.
  mouse.poll();
  loop.step();
  dispatchAlerts();
}

const root = document.getElementById("root");

function paint(): void {
  if (root === null) return;
  render(
    <App
      loop={loop}
      presets={presets}
      activePreset={activeName}
      settings={settings}
      onSelectPreset={(name) => {
        activeName = name;
        store.saveActivePresetName(name);
        applyPreset();
      }}
      onImport={(imported) => {
        // Imported names win over existing ones so re-importing updates in place.
        const byName = new Map(presets.map((p) => [p.name, p]));
        for (const p of imported) byName.set(p.name, p);
        presets = [...byName.values()];
        store.savePresets(presets);
        if (activeName === null || !byName.has(activeName)) {
          activeName = imported[0]?.name ?? null;
          store.saveActivePresetName(activeName);
        }
        applyPreset();
      }}
      onSettings={(next) => {
        settings = next;
        store.saveSettings(next);
        paint();
      }}
      onTogglePause={(index) => {
        mutateAlerts((alerts) => {
          const a = alerts[index];
          if (a !== undefined) a.paused = !a.paused;
        });
      }}
      onSaveAlert={(index, next) => {
        mutateAlerts((alerts) => {
          if (index === null) alerts.push(next);
          else alerts[index] = next;
        });
      }}
      onDeleteAlert={(index) => {
        mutateAlerts((alerts) => {
          alerts.splice(index, 1);
        });
      }}
      onPresetAction={handlePresetAction}
    />,
    root,
  );
}

/** Edit the active preset's alerts in place, then persist and rebuild the runtime. */
function mutateAlerts(fn: (alerts: AlerterBase[]) => void): void {
  const preset = activePreset();
  if (preset === null) return;
  fn(preset.alerters);
  // Groups are derived from the alerts, so recompute rather than letting the two
  // drift apart.
  preset.groups = [...new Set(preset.alerters.map((a) => a.group).filter((g): g is string => g !== null))];
  store.savePresets(presets);
  applyPreset();
}

function uniqueName(base: string): string {
  if (!presets.some((p) => p.name === base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base} ${n}`;
    if (!presets.some((p) => p.name === candidate)) return candidate;
  }
}

function handlePresetAction(action: PresetAction): void {
  const current = activePreset();

  if (action.kind === "new") {
    const preset = PresetSchema.parse({ name: uniqueName(action.name), alerters: [] });
    presets = [...presets, preset];
    activeName = preset.name;
  } else if (action.kind === "duplicate") {
    if (current === null) return;
    const copy = PresetSchema.parse({
      ...structuredClone(current),
      name: uniqueName(action.name),
    });
    presets = [...presets, copy];
    activeName = copy.name;
  } else if (action.kind === "rename") {
    if (current === null) return;
    const name = uniqueName(action.name);
    // Renaming in place keeps position in the list, which is where the user
    // expects to find it afterwards.
    current.name = name;
    activeName = name;
  } else {
    if (current === null) return;
    presets = presets.filter((p) => p !== current);
    activeName = presets[0]?.name ?? null;
  }

  store.savePresets(presets);
  store.saveActivePresetName(activeName);
  applyPreset();
}

applyPreset();
setInterval(tick, TICK_MS);
