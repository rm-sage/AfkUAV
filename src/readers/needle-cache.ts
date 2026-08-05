import type { Needle } from "~/readers/buff-match";

export type NeedleDecoder = (base64: string) => Promise<Needle | null>;

const cache = new Map<string, Needle | null>();
const pending = new Set<string>();

/**
 * Decode a base64 PNG into RGBA pixels using the DOM.
 *
 * Buff templates are stored as base64 PNGs, so decoding needs a canvas and is
 * inherently async. Keeping it behind a replaceable decoder lets every consumer
 * stay synchronous and lets tests supply pixels directly.
 */
const domDecoder: NeedleDecoder = async (base64) => {
  if (typeof document === "undefined") return null;
  try {
    const img = new Image();
    const loaded = new Promise<boolean>((resolve) => {
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
    });
    img.src = base64.startsWith("data:") ? base64 : `data:image/png;base64,${base64}`;
    if (!(await loaded)) return null;

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (ctx === null) return null;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return { width: data.width, height: data.height, data: data.data };
  } catch {
    return null;
  }
};

let decoder: NeedleDecoder = domDecoder;

export function setNeedleDecoder(next: NeedleDecoder): void {
  decoder = next;
}

/** Insert a decoded needle directly. Used by tests and by any eager preload. */
export function primeNeedle(base64: string, needle: Needle | null): void {
  cache.set(base64, needle);
}

export function clearNeedleCache(): void {
  cache.clear();
  pending.clear();
}

/**
 * The decoded needle if it is ready, otherwise null while decoding starts.
 *
 * Returning null rather than blocking means an alert reports "no data" for a tick
 * or two after load instead of stalling the whole loop.
 */
export function getNeedle(base64: string): Needle | null {
  if (cache.has(base64)) return cache.get(base64) ?? null;
  if (!pending.has(base64)) {
    pending.add(base64);
    void decoder(base64).then((needle) => {
      cache.set(base64, needle);
      pending.delete(base64);
    });
  }
  return null;
}
