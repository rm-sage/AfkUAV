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
} from "~/alt1-io/host";
import { MouseActivityWatch } from "~/alt1-io/activity";
import { actionbarReader, buffReader, xpReader } from "~/alt1-io/readers";
import { TickReaders } from "~/readers/bundle";
import { AlarmScheduler } from "~/alerting/alarm";
import { SoundPlayer } from "~/alerting/player";
import { ChatboxPool } from "~/readers/chatbox-pool";
import { TICK_MS, TickLoop } from "~/engine/loop";
import { Store } from "~/store/storage";
import type { Preset, Settings } from "~/store/schema";
import { speak } from "~/alerting/speech";
import { App } from "~/ui/App";
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

/** Alerts that were speaking last tick, so each transition speaks exactly once. */
const spoken = new Set<string>();

function dispatchAlerts(): void {
  const focused = rsFocused();
  const suppressed = settings.muted || (settings.activeSuppress && focused);
  const tooltips: string[] = [];

  const sources = loop.alerters.map((a, i) => ({
    key: `${i}:${a.config.name}`,
    triggered: a.state.triggered,
    alarm: a.config.alarm,
    globalalarm: a.config.globalalarm,
  }));

  player.apply(alarms.update(sources, settings, focused));

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
        const a = loop.alerters[index];
        if (a === undefined) return;
        a.config.paused = !a.config.paused;
        const preset = activePreset();
        if (preset !== null) store.savePresets(presets);
        paint();
      }}
    />,
    root,
  );
}

applyPreset();
setInterval(tick, TICK_MS);
