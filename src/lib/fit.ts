/**
 * Fit and zoom maths shared by the web, the Board and the Brain. Pure: no
 * React, no DOM. A transform maps content space to screen space as
 * screen = k * point + (x, y).
 */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface ZoomTransform {
  k: number;
  x: number;
  y: number;
}

export interface ZoomLimits {
  min: number;
  max: number;
}

/** Clamp a zoom factor into [min, max]. A non-finite factor falls back to 1, then clamps. */
export function clampZoom(k: number, limits: ZoomLimits): number {
  const lo = Math.min(limits.min, limits.max);
  const hi = Math.max(limits.min, limits.max);
  const v = Number.isFinite(k) ? k : 1;
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Scale and centre `content` inside `viewport`, leaving `pad` pixels on every
 * side. Zero-size content (one point, or nothing) is centred at zoom 1 before
 * clamping, so it never divides by zero.
 */
export function fitTransform(content: Box, viewport: Size, pad: number, limits: ZoomLimits): ZoomTransform {
  const availW = Math.max(1, viewport.width - pad * 2);
  const availH = Math.max(1, viewport.height - pad * 2);
  const raw =
    content.width > 0 && content.height > 0
      ? Math.min(availW / content.width, availH / content.height)
      : content.width > 0
        ? availW / content.width
        : content.height > 0
          ? availH / content.height
          : 1;
  const k = clampZoom(raw, limits);
  const cx = content.x + content.width / 2;
  const cy = content.y + content.height / 2;
  return { k, x: viewport.width / 2 - cx * k, y: viewport.height / 2 - cy * k };
}

/** Zoom by `factor` about a screen point, keeping that point fixed. */
export function zoomAbout(t: ZoomTransform, factor: number, at: { x: number; y: number }, limits: ZoomLimits): ZoomTransform {
  const k = clampZoom(t.k * factor, limits);
  const r = k / t.k;
  return { k, x: at.x - (at.x - t.x) * r, y: at.y - (at.y - t.y) * r };
}
