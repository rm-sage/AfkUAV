import type { AlarmCommand } from "~/alerting/alarm";
import { resolveTone, toneDurationMs, type ToneSpec } from "~/alerting/tones";

/** Resolves a stored sound name to playable audio, if a custom one is registered. */
export interface CustomSoundSource {
  /** Object URL for a user-supplied sound, or null to fall back to a built-in tone. */
  urlFor(sound: string): string | null;
}

type Voice = {
  stop(): void;
};

/**
 * Plays alarm commands.
 *
 * Deliberately thin: every decision about *whether* to sound lives in
 * AlarmScheduler, which is testable without a DOM. This class only knows how to
 * make noise and how to stop.
 */
export class SoundPlayer {
  #voices = new Map<string, Voice>();
  #ctx: AudioContext | null = null;
  #custom: CustomSoundSource | null;

  constructor(custom: CustomSoundSource | null = null) {
    this.#custom = custom;
  }

  setCustomSource(custom: CustomSoundSource | null): void {
    this.#custom = custom;
  }

  apply(commands: readonly AlarmCommand[]): void {
    for (const c of commands) {
      if (c.kind === "stop") this.#stop(c.key);
      else this.#play(c.key, c.sound, c.repeat, c.volume);
    }
  }

  stopAll(): void {
    for (const key of [...this.#voices.keys()]) this.#stop(key);
  }

  #stop(key: string): void {
    this.#voices.get(key)?.stop();
    this.#voices.delete(key);
  }

  #play(key: string, sound: string, repeat: boolean, volume: number): void {
    this.#stop(key);

    const url = this.#custom?.urlFor(sound) ?? null;
    const voice = url !== null
      ? this.#playAudio(url, repeat, volume)
      : this.#playTone(resolveTone(sound), repeat, volume);

    if (voice !== null) this.#voices.set(key, voice);
  }

  #playAudio(url: string, repeat: boolean, volume: number): Voice | null {
    try {
      const audio = new Audio(url);
      audio.loop = repeat;
      audio.volume = Math.min(1, Math.max(0, volume));
      void audio.play().catch(() => {
        /* Autoplay policy or a decode failure; nothing useful to do per-tick. */
      });
      return {
        stop() {
          audio.pause();
          audio.currentTime = 0;
        },
      };
    } catch {
      return null;
    }
  }

  #audioContext(): AudioContext | null {
    try {
      this.#ctx ??= new AudioContext();
      // Alt1 loads the page without a user gesture, so the context can start
      // suspended. Resuming is best-effort and harmless when already running.
      if (this.#ctx.state === "suspended") void this.#ctx.resume();
      return this.#ctx;
    } catch {
      return null;
    }
  }

  #playTone(spec: ToneSpec, repeat: boolean, volume: number): Voice | null {
    const ctx = this.#audioContext();
    if (ctx === null) return null;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const nodes = new Set<OscillatorNode>();

    const runOnce = (): void => {
      if (cancelled) return;
      let at = ctx.currentTime;
      for (const step of spec.steps) {
        const seconds = step.ms / 1000;
        if (step.freq > 0) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = step.type ?? "sine";
          osc.frequency.value = step.freq;
          // Short ramps: a square wave gated instantly clicks audibly.
          gain.gain.setValueAtTime(0, at);
          gain.gain.linearRampToValueAtTime(Math.min(1, Math.max(0, volume)) * 0.25, at + 0.01);
          gain.gain.setValueAtTime(Math.min(1, Math.max(0, volume)) * 0.25, at + seconds - 0.01);
          gain.gain.linearRampToValueAtTime(0, at + seconds);
          osc.connect(gain).connect(ctx.destination);
          osc.start(at);
          osc.stop(at + seconds);
          nodes.add(osc);
          osc.onended = () => nodes.delete(osc);
        }
        at += seconds;
      }

      if (repeat && !cancelled) {
        timer = setTimeout(runOnce, toneDurationMs(spec) + spec.repeatGapMs);
      }
    };

    runOnce();

    return {
      stop() {
        cancelled = true;
        if (timer !== null) clearTimeout(timer);
        for (const osc of nodes) {
          try {
            osc.stop();
          } catch {
            /* Already stopped. */
          }
        }
        nodes.clear();
      },
    };
  }
}
