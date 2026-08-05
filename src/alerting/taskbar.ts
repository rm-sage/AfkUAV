/** Alt1 taskbar bar styles. 0 clears the bar entirely. */
export const TASKBAR_NONE = 0;
export const TASKBAR_NORMAL = 1;
export const TASKBAR_ERROR = 2;

export type TaskbarState = { type: number; progress: number };

/** Above this the bar turns red — you are nearly out of time. */
const URGENT_AT = 80;

export type ProgressSource = {
  paused: boolean;
  triggered: boolean;
  /** 0..1 progress toward triggering. */
  bar: number;
  /** Whether this alert contributes to the shared progress bar. */
  exportbar: boolean;
};

/**
 * The taskbar bar answers one question: how long until you have to click?
 *
 * It is the maximum progress across alerts that opted in via `exportbar`, jumping
 * to full the moment anything actually fires. The floor of 1 keeps a sliver
 * visible so the bar reads as "armed" rather than absent.
 */
export function taskbarState(
  sources: readonly ProgressSource[],
  showOverlay: boolean,
): TaskbarState {
  if (!showOverlay) return { type: TASKBAR_NONE, progress: 0 };

  let maxBar = 0;
  let triggered = false;
  for (const s of sources) {
    if (s.paused) continue;
    if (s.triggered) triggered = true;
    if (s.exportbar) maxBar = Math.max(maxBar, s.bar);
  }

  const progress = Math.round(Math.max(1, triggered ? 100 : maxBar * 100));
  return { type: progress >= URGENT_AT ? TASKBAR_ERROR : TASKBAR_NORMAL, progress };
}

export type TaskbarSetter = (type: number, progress: number) => void;

/** Pushes taskbar updates only when they change, since the call crosses into the host. */
export class TaskbarBar {
  #last: TaskbarState | null = null;

  constructor(private readonly setter: TaskbarSetter | null) {}

  apply(next: TaskbarState): void {
    if (this.setter === null) return;
    if (this.#last !== null && this.#last.type === next.type && this.#last.progress === next.progress) {
      return;
    }
    this.#last = next;
    this.setter(next.type, next.progress);
  }

  /** Clear the bar so a closed app does not leave the taskbar decorated. */
  clear(): void {
    if (this.setter === null) return;
    this.#last = null;
    this.setter(TASKBAR_NONE, 0);
  }
}

/**
 * Whether alarms should stay quiet because you are plainly at the keyboard.
 *
 * Not "is RuneScape focused" — AfkWarden keys this off how recently you clicked,
 * which is the better signal: alt-tabbing to read something does not mean you
 * stopped playing, but having clicked two seconds ago does.
 */
export function shouldSuppress(
  activeSuppress: boolean,
  idleMs: number,
  rsFocused: boolean,
): boolean {
  if (!activeSuppress) return false;
  if (idleMs < 4000) return true;
  if (idleMs < 7000 && rsFocused) return true;
  return false;
}
