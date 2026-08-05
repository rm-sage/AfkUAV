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

export function rsLastActive(): number {
  if (!hasAlt1()) return Date.now();
  const v = (alt1 as Record<string, unknown>).rsLastActive;
  return typeof v === "number" ? v : Date.now();
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

export function setTooltip(text: string): void {
  if (!hasAlt1()) return;
  const a = alt1 as Record<string, unknown>;
  const set = a.setTooltip as ((s: string) => void) | undefined;
  const clear = a.clearTooltip as (() => void) | undefined;
  if (text.length === 0) clear?.();
  else set?.(text);
}
