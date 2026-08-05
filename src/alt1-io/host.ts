import * as a1lib from "alt1/base";
import * as chatboxModule from "alt1/chatbox";
import type { Alt1Host } from "~/alt1-io/geometry";
import type { ChatboxLike } from "~/readers/chatbox-pool";
import { interopDefault } from "~/alt1-io/interop";

type ChatBoxReaderCtor = new () => ChatboxLike;

/** alt1 ships webpack UMD bundles; the class sits under nested `.default`. */
const ChatBoxReader = interopDefault<ChatBoxReaderCtor>(chatboxModule);

/**
 * The only module permitted to touch the `alt1` global or the alt1 package.
 *
 * Everything downstream depends on plain interfaces, which is what lets the entire
 * engine and reader layer run under Vitest with no host, no game and no screen.
 */

declare const alt1: undefined | Record<string, unknown>;

export function hasAlt1(): boolean {
  return typeof alt1 !== "undefined" && alt1 !== null;
}

export type Permissions = {
  pixel: boolean;
  overlay: boolean;
  gameState: boolean;
  installed: boolean;
};

export function permissions(): Permissions {
  if (!hasAlt1()) {
    return { pixel: false, overlay: false, gameState: false, installed: false };
  }
  const a = alt1 as Record<string, unknown>;
  return {
    pixel: a.permissionPixel === true,
    overlay: a.permissionOverlay === true,
    gameState: a.permissionGameState === true,
    installed: a.permissionInstalled === true,
  };
}

/** Live view of the host's geometry fields. Reads through on every access. */
export const liveHost: Alt1Host = {
  get rsX() {
    return hasAlt1() ? Number((alt1 as Record<string, unknown>).rsX ?? 0) : 0;
  },
  get rsY() {
    return hasAlt1() ? Number((alt1 as Record<string, unknown>).rsY ?? 0) : 0;
  },
  get rsWidth() {
    return hasAlt1() ? Number((alt1 as Record<string, unknown>).rsWidth ?? 0) : 0;
  },
  get rsHeight() {
    return hasAlt1() ? Number((alt1 as Record<string, unknown>).rsHeight ?? 0) : 0;
  },
  get rsScaling() {
    return hasAlt1() ? Number((alt1 as Record<string, unknown>).rsScaling ?? 1) : 1;
  },
  get rsLinked() {
    return hasAlt1() && (alt1 as Record<string, unknown>).rsLinked === true;
  },
};

/**
 * Milliseconds since the last click in the RS window.
 *
 * Alt1 documents `rsLastActive` as "the time in milliseconds SINCE the last click"
 * -- a duration, despite a name that reads like a timestamp. Subtracting it from
 * Date.now() yields ~1.7e12 ms of apparent idleness and pins every inactivity
 * alert permanently on.
 *
 * Returns 0 (just clicked) when unavailable, so alerts stay quiet rather than
 * screaming; `hasGameState()` is what surfaces the reason.
 */
export function idleMs(): number {
  if (!hasAlt1()) return 0;
  const v = (alt1 as Record<string, unknown>).rsLastActive;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function hasGameState(): boolean {
  return permissions().gameState;
}

/** Whether RuneScape is the active window, for the suppress-while-playing setting. */
export function rsFocused(): boolean {
  if (!hasAlt1()) return false;
  return (alt1 as Record<string, unknown>).rsActive === true;
}

/**
 * In-game cursor position, or null when the cursor is outside the RS client.
 *
 * Alt1 packs it as a single int (`x = r >> 16`, `y = r & 0xFFFF`) and uses -1 as
 * the "not inside the client" sentinel. Requires Gamestate.
 */
export function mousePosition(): { x: number; y: number } | null {
  if (!hasAlt1()) return null;
  const v = (alt1 as Record<string, unknown>).mousePosition;
  if (typeof v !== "number" || v === -1) return null;
  return { x: v >> 16, y: v & 0xffff };
}

/**
 * One capture per tick, shared by every reader.
 *
 * Returns null rather than throwing when RS is not visible: a missing frame is an
 * ordinary condition (game minimised, alt-tabbed) and must not interrupt the loop.
 */
export function captureRs(): unknown | null {
  if (!hasAlt1() || !permissions().pixel) return null;
  try {
    return a1lib.captureHoldFullRs();
  } catch {
    return null;
  }
}

export function makeChatboxReader(): ChatboxLike {
  return new ChatBoxReader();
}

export function mixColor(r: number, g: number, b: number): number {
  return a1lib.mixColor(r, g, b);
}

export function identify(): void {
  if (!hasAlt1()) return;
  try {
    a1lib.identifyApp("appconfig.json");
  } catch {
    /* identifyApp is best-effort; a failure here must not block startup. */
  }
}

/** Draw a labelled rectangle over a detected chatbox, so "which box" is never a guess. */
export function highlightBox(
  rect: { x: number; y: number; width: number; height: number },
  label: string,
  ms = 2000,
): void {
  if (!hasAlt1() || !permissions().overlay) return;
  const a = alt1 as Record<string, unknown>;
  const overLayRect = a.overLayRect as
    | ((c: number, x: number, y: number, w: number, h: number, t: number, lw: number) => void)
    | undefined;
  const overLayText = a.overLayText as
    | ((s: string, c: number, size: number, x: number, y: number, t: number) => void)
    | undefined;

  overLayRect?.(mixColor(255, 255, 255), rect.x, rect.y, rect.width, rect.height, ms, 2);
  overLayText?.(label, mixColor(255, 255, 255), 12, rect.x + 4, rect.y + 14, ms);
}

/**
 * Draws a progress bar over the RuneScape taskbar icon, or null when unavailable.
 *
 * Returned as a function rather than called directly so the consumer can hold a
 * stable reference and stay testable.
 */
export function taskbarSetter(): ((type: number, progress: number) => void) | null {
  if (!hasAlt1()) return null;
  const fn = (alt1 as Record<string, unknown>).setTaskbarProgress;
  if (typeof fn !== "function") return null;
  return (type: number, progress: number) => {
    try {
      (fn as (t: number, p: number) => void)(type, progress);
    } catch {
      /* Host rejected the call; nothing useful to do per-tick. */
    }
  };
}

export function setTooltip(text: string): void {
  if (!hasAlt1()) return;
  const a = alt1 as Record<string, unknown>;
  const set = a.setTooltip as ((s: string) => void) | undefined;
  const clear = a.clearTooltip as (() => void) | undefined;
  if (text.length === 0) clear?.();
  else set?.(text);
}
