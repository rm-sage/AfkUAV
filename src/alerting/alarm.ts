import type { Alarm, Settings } from "~/store/schema";

export type AlarmSource = {
  /** Stable identity for this alert within the active preset. */
  key: string;
  triggered: boolean;
  alarm: Alarm | null;
  globalalarm: boolean;
};

export type AlarmCommand =
  | { kind: "play"; key: string; sound: string; repeat: boolean; volume: number }
  | { kind: "stop"; key: string };

/**
 * Which sound an alert should make, if any.
 *
 * Matches AfkWarden: an alert's own alarm wins, otherwise it borrows the global
 * alarm when `globalalarm` is set, otherwise it is silent. Most real alerts carry
 * `alarm: null, globalalarm: true`, so the global fallback is the common path
 * rather than an edge case.
 */
export function resolveAlarm(source: AlarmSource, settings: Settings): Alarm | null {
  if (source.alarm !== null) return source.alarm;
  if (!source.globalalarm) return null;
  return settings.globalAlarm;
}

/**
 * Turns per-tick trigger state into play/stop commands.
 *
 * Kept free of any audio API so the decisions — edge detection, repeat, mute,
 * suppression, preset switches — are testable without a DOM. Playback is a thin
 * consumer of these commands.
 */
export class AlarmScheduler {
  #sounding = new Set<string>();

  /**
   * @param activitySuppressed whether recent play should keep alarms quiet.
   *   Computed by `shouldSuppress`, which already accounts for the
   *   `activeSuppress` setting, so it is used as-is rather than re-tested here.
   */
  update(
    sources: readonly AlarmSource[],
    settings: Settings,
    activitySuppressed = false,
  ): AlarmCommand[] {
    const commands: AlarmCommand[] = [];
    const suppressed = settings.muted || activitySuppressed;
    const seen = new Set<string>();

    for (const source of sources) {
      seen.add(source.key);
      const resolved = resolveAlarm(source, settings);
      const shouldSound = source.triggered && resolved !== null && !suppressed;
      const wasSounding = this.#sounding.has(source.key);

      if (shouldSound && !wasSounding) {
        this.#sounding.add(source.key);
        commands.push({
          kind: "play",
          key: source.key,
          sound: resolved!.sound,
          repeat: resolved!.repeat,
          volume: settings.volume,
        });
      } else if (!shouldSound && wasSounding) {
        this.#sounding.delete(source.key);
        commands.push({ kind: "stop", key: source.key });
      }
    }

    // An alert that vanished (preset switch, deletion) must not keep sounding.
    for (const key of [...this.#sounding]) {
      if (seen.has(key)) continue;
      this.#sounding.delete(key);
      commands.push({ kind: "stop", key });
    }

    return commands;
  }

  /** Silence everything, e.g. on shutdown. */
  stopAll(): AlarmCommand[] {
    const commands = [...this.#sounding].map((key): AlarmCommand => ({ kind: "stop", key }));
    this.#sounding.clear();
    return commands;
  }
}
