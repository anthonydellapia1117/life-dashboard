import { describe, expect, it } from 'vitest';
import { clampZoom, fitTransform, zoomAbout } from '../src/lib/fit';

const LIM = { min: 0.5, max: 3 };

describe('clampZoom', () => {
  it('clamps into the range and survives bad input', () => {
    expect(clampZoom(0.1, LIM)).toBe(0.5);
    expect(clampZoom(9, LIM)).toBe(3);
    expect(clampZoom(1.2, LIM)).toBe(1.2);
    expect(clampZoom(Number.NaN, LIM)).toBe(1);
    expect(clampZoom(Infinity, LIM)).toBe(1);
    expect(clampZoom(5, { min: 2, max: 0.5 })).toBe(2);
  });
});

describe('fitTransform', () => {
  it('scales to the tighter side with padding and centres the content', () => {
    const t = fitTransform({ x: 0, y: 0, width: 200, height: 100 }, { width: 420, height: 420 }, 10, LIM);
    expect(t.k).toBe(2);
    // Content centre (100, 50) lands on the viewport centre (210, 210).
    expect(100 * t.k + t.x).toBe(210);
    expect(50 * t.k + t.y).toBe(210);
    // Left edge sits exactly on the padding.
    expect(0 * t.k + t.x).toBe(10);
  });

  it('centres content that is offset from the origin', () => {
    const t = fitTransform({ x: -300, y: 40, width: 100, height: 100 }, { width: 200, height: 200 }, 0, LIM);
    expect(t.k).toBe(2);
    expect(-250 * t.k + t.x).toBe(100);
    expect(90 * t.k + t.y).toBe(100);
  });

  it('clamps to the zoom limits', () => {
    expect(fitTransform({ x: 0, y: 0, width: 10, height: 10 }, { width: 1000, height: 1000 }, 0, LIM).k).toBe(3);
    expect(fitTransform({ x: 0, y: 0, width: 10000, height: 10000 }, { width: 100, height: 100 }, 0, LIM).k).toBe(0.5);
  });

  it('handles zero-size and one-dimensional content without dividing by zero', () => {
    const point = fitTransform({ x: 50, y: 50, width: 0, height: 0 }, { width: 300, height: 200 }, 16, LIM);
    expect(point.k).toBe(1);
    expect(50 * point.k + point.x).toBe(150);
    expect(50 * point.k + point.y).toBe(100);
    const line = fitTransform({ x: 0, y: 0, width: 100, height: 0 }, { width: 220, height: 50 }, 10, LIM);
    expect(line.k).toBe(2);
    expect([line.k, line.x, line.y].every(Number.isFinite)).toBe(true);
  });

  it('copes with a viewport smaller than the padding', () => {
    const t = fitTransform({ x: 0, y: 0, width: 100, height: 100 }, { width: 10, height: 10 }, 20, LIM);
    expect(t.k).toBe(0.5);
    expect([t.x, t.y].every(Number.isFinite)).toBe(true);
  });
});

describe('zoomAbout', () => {
  it('keeps the anchor point fixed on screen', () => {
    const t = { k: 1, x: 20, y: -10 };
    const at = { x: 150, y: 90 };
    const before = { x: (at.x - t.x) / t.k, y: (at.y - t.y) / t.k };
    const z = zoomAbout(t, 2, at, LIM);
    expect(z.k).toBe(2);
    expect(before.x * z.k + z.x).toBeCloseTo(at.x);
    expect(before.y * z.k + z.y).toBeCloseTo(at.y);
  });

  it('stops at the limits and leaves the view still there', () => {
    const t = { k: 3, x: 5, y: 5 };
    expect(zoomAbout(t, 2, { x: 0, y: 0 }, LIM)).toEqual(t);
    expect(zoomAbout({ k: 1, x: 0, y: 0 }, 0.1, { x: 0, y: 0 }, LIM).k).toBe(0.5);
  });
});
