import type { Needle } from "~/readers/buff-match";

/**
 * Render captured RGBA pixels to a PNG data URL.
 *
 * Buff icons live as raw pixel buffers in the reader layer but have to become
 * images to be shown or stored. Canvas is the only route to PNG in the browser.
 */
export function needleToDataUrl(needle: Needle): string | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = needle.width;
    canvas.height = needle.height;
    const ctx = canvas.getContext("2d");
    if (ctx === null) return null;

    const image = ctx.createImageData(needle.width, needle.height);
    image.data.set(needle.data);
    ctx.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

/**
 * The same PNG without the data-URL prefix.
 *
 * That is exactly the shape AfkWarden stores in `bufftype.imgstr`, so an alert
 * captured here still exports to a file AfkWarden can load.
 */
export function needleToBase64(needle: Needle): string | null {
  const url = needleToDataUrl(needle);
  if (url === null) return null;
  const comma = url.indexOf(",");
  return comma === -1 ? null : url.slice(comma + 1);
}
