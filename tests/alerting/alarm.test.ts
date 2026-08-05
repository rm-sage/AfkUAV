import { describe, expect, it } from "vitest";
import { AlarmScheduler, resolveAlarm, type AlarmSource } from "~/alerting/alarm";
import { DEFAULT_SETTINGS, type Settings } from "~/store/schema";

function settings(over: Partial<Settings> = {}): Settings {
  return { ...DEFAULT_SETTINGS, ...over };
}

function src(over: Partial<AlarmSource> = {}): AlarmSource {
  return { key: "a", triggered: false, alarm: null, globalalarm: true, ...over };
}

describe("resolveAlarm", () => {
  it("prefers the alerter's own alarm", () => {
    const r = resolveAlarm(src({ alarm: { sound: "mine", repeat: true }, globalalarm: true }), settings());
    expect(r).toEqual({ sound: "mine", repeat: true });
  });

  it("falls back to the global alarm when globalalarm is set", () => {
    const r = resolveAlarm(src({ alarm: null, globalalarm: true }), settings());
    expect(r).toEqual({ sound: "elevator", repeat: false });
  });

  it("is silent when there is no own alarm and globalalarm is off", () => {
    expect(resolveAlarm(src({ alarm: null, globalalarm: false }), settings())).toBeNull();
  });

  it("is silent when the global alarm itself is unset", () => {
    expect(resolveAlarm(src({ alarm: null, globalalarm: true }), settings({ globalAlarm: null }))).toBeNull();
  });

  it("still resolves an own alarm when globalalarm is off", () => {
    const r = resolveAlarm(src({ alarm: { sound: "mine", repeat: false }, globalalarm: false }), settings());
    expect(r).toEqual({ sound: "mine", repeat: false });
  });
});

describe("AlarmScheduler", () => {
  it("plays once on the untriggered -> triggered transition", () => {
    const s = new AlarmScheduler();
    expect(s.update([src({ triggered: false })], settings())).toEqual([]);
    expect(s.update([src({ triggered: true })], settings())).toEqual([
      { kind: "play", key: "a", sound: "elevator", repeat: false, volume: 0.5 },
    ]);
  });

  it("does not replay while the alert stays triggered", () => {
    const s = new AlarmScheduler();
    s.update([src({ triggered: true })], settings());
    expect(s.update([src({ triggered: true })], settings())).toEqual([]);
  });

  it("stops on the triggered -> untriggered transition", () => {
    const s = new AlarmScheduler();
    s.update([src({ triggered: true })], settings());
    expect(s.update([src({ triggered: false })], settings())).toEqual([{ kind: "stop", key: "a" }]);
  });

  it("re-plays after the alert clears and fires again", () => {
    const s = new AlarmScheduler();
    s.update([src({ triggered: true })], settings());
    s.update([src({ triggered: false })], settings());
    expect(s.update([src({ triggered: true })], settings())).toHaveLength(1);
  });

  it("carries the repeat flag through", () => {
    const s = new AlarmScheduler();
    const a = src({ triggered: true, alarm: { sound: "siren", repeat: true } });
    expect(s.update([a], settings())).toEqual([
      { kind: "play", key: "a", sound: "siren", repeat: true, volume: 0.5 },
    ]);
  });

  it("passes the configured volume", () => {
    const s = new AlarmScheduler();
    const cmds = s.update([src({ triggered: true })], settings({ volume: 0.2 }));
    expect(cmds[0]).toMatchObject({ volume: 0.2 });
  });

  it("emits nothing while muted", () => {
    const s = new AlarmScheduler();
    expect(s.update([src({ triggered: true })], settings({ muted: true }))).toEqual([]);
  });

  // Muting mid-alarm has to actually silence a repeating sound, not just skip
  // future plays.
  it("stops a sounding alarm when muted mid-alert", () => {
    const s = new AlarmScheduler();
    s.update([src({ triggered: true, alarm: { sound: "siren", repeat: true } })], settings());
    const cmds = s.update(
      [src({ triggered: true, alarm: { sound: "siren", repeat: true } })],
      settings({ muted: true }),
    );
    expect(cmds).toEqual([{ kind: "stop", key: "a" }]);
  });

  it("emits nothing for an alert with no resolvable sound", () => {
    const s = new AlarmScheduler();
    expect(s.update([src({ triggered: true, globalalarm: false })], settings())).toEqual([]);
  });

  it("tracks alerts independently", () => {
    const s = new AlarmScheduler();
    s.update([src({ key: "a", triggered: true }), src({ key: "b", triggered: false })], settings());
    const cmds = s.update(
      [src({ key: "a", triggered: true }), src({ key: "b", triggered: true })],
      settings(),
    );
    expect(cmds).toEqual([
      { kind: "play", key: "b", sound: "elevator", repeat: false, volume: 0.5 },
    ]);
  });

  // Switching preset replaces the alerter set; sounds from the old one must not
  // keep playing forever.
  it("stops alarms for alerts that disappear", () => {
    const s = new AlarmScheduler();
    s.update([src({ key: "a", triggered: true })], settings());
    expect(s.update([], settings())).toEqual([{ kind: "stop", key: "a" }]);
  });

  // The caller computes this via shouldSuppress, which already accounts for the
  // activeSuppress setting; the scheduler takes it at face value.
  it("emits nothing while activity suppression is in effect", () => {
    const s = new AlarmScheduler();
    expect(s.update([src({ triggered: true })], settings(), true)).toEqual([]);
  });

  it("alarms normally when activity suppression is not in effect", () => {
    const s = new AlarmScheduler();
    expect(s.update([src({ triggered: true })], settings(), false)).toHaveLength(1);
  });

  it("stops a sounding alarm when suppression kicks in mid-alert", () => {
    const s = new AlarmScheduler();
    s.update([src({ triggered: true })], settings(), false);
    expect(s.update([src({ triggered: true })], settings(), true)).toEqual([
      { kind: "stop", key: "a" },
    ]);
  });
});
