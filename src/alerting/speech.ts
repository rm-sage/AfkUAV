import type { Voice } from "~/store/schema";

/**
 * Text-to-speech via the Web Speech API.
 *
 * AfkWarden generates speech server-side (`runeapps.org/node/speech/sound?text=...`),
 * which makes every spoken alert a network round trip and ties the app to a host
 * nobody else controls. Chromium routes speechSynthesis through the platform
 * engine -- SAPI on Windows -- so this runs locally with no backend.
 *
 * AfkWarden's speed is words-per-minute (50..500, default 175) and its pitch is
 * 0..100 (default 50). The Web Speech API takes rate as a multiplier (0.1..10,
 * default 1) and pitch as 0..2, so both are converted here rather than at call sites.
 */

export function isSupported(): boolean {
  return typeof globalThis !== "undefined" && "speechSynthesis" in globalThis;
}

/** 175 wpm is AfkWarden's default and corresponds to rate 1. */
export function toRate(wordsPerMinute: number): number {
  const rate = wordsPerMinute / 175;
  return Math.min(10, Math.max(0.1, rate));
}

/** 50 is AfkWarden's neutral pitch and corresponds to Web Speech pitch 1. */
export function toPitch(pitch0to100: number): number {
  const p = pitch0to100 / 50;
  return Math.min(2, Math.max(0, p));
}

export function speak(voice: Voice, volume: number): void {
  if (!isSupported() || voice.text.length === 0) return;
  const synth = globalThis.speechSynthesis;
  const u = new SpeechSynthesisUtterance(voice.text);
  u.rate = toRate(voice.speed);
  u.pitch = toPitch(voice.pitch);
  u.volume = Math.min(1, Math.max(0, volume));
  synth.speak(u);
}

export function stop(): void {
  if (!isSupported()) return;
  globalThis.speechSynthesis.cancel();
}
