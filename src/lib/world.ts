/**
 * Colour worlds. Every tab owns one: the page ground, the header band, the
 * accent and the ink are all set by one attribute, `html[data-world]`, and
 * global.css maps the semantic tokens the components already read onto that
 * world's tokens. Grade and bucket colours never change per world, so colour
 * means the same thing on every tab.
 *
 * Pure and DOM-free: worldFor is a lookup, applyWorld takes the document it
 * writes to, so both run under vitest's node environment with a fake document.
 */
import type { SectionId, ZoneId } from './routing';

export type World = 'neutral' | 'work' | 'ayvede' | 'life' | 'build' | 'claude';

export const WORLDS: World[] = ['neutral', 'work', 'ayvede', 'life', 'build', 'claude'];

/** Browser chrome colour per world, light then dark - the same hexes global.css uses for each ground. */
export const THEME_COLORS: Record<World, { light: string; dark: string }> = {
  neutral: { light: '#F2F2F7', dark: '#000000' },
  // Dark is color-mix(in srgb, #4F2D7F 62%, #000) written out, because a meta tag cannot read CSS.
  work: { light: '#4F2D7F', dark: '#311C4F' },
  ayvede: { light: '#0b1120', dark: '#0b1120' },
  life: { light: '#FFF1B8', dark: '#2A2410' },
  build: { light: '#E6ECF4', dark: '#1C222B' },
  claude: { light: '#faf9f5', dark: '#141413' },
};

/** Which world a route lives in. Unknown zones or sections fall back to neutral. */
export function worldFor(zone: ZoneId | string, section?: SectionId | string): World {
  switch (zone) {
    case 'work':
      if (section === 'business') return 'ayvede';
      if (section === undefined || section === 'engagement' || section === 'career') return 'work';
      return 'neutral';
    case 'life':
      return 'life';
    case 'build':
      return 'build';
    case 'claude':
      return 'claude';
    default:
      return 'neutral';
  }
}

/** The slice of Document applyWorld touches - enough for a fake in tests. */
export interface WorldDoc {
  documentElement: { setAttribute(name: string, value: string): void };
  querySelectorAll(selector: string): ArrayLike<{ getAttribute(name: string): string | null; setAttribute(name: string, value: string): void }>;
}

/**
 * Set `html[data-world]` and rewrite every theme-color meta so the phone's
 * status bar matches the ground. A meta with a dark media query gets the dark
 * step, every other one the light step.
 */
export function applyWorld(doc: WorldDoc, world: World): void {
  doc.documentElement.setAttribute('data-world', world);
  const colors = THEME_COLORS[world] ?? THEME_COLORS.neutral;
  const metas = doc.querySelectorAll('meta[name="theme-color"]');
  for (let i = 0; i < metas.length; i++) {
    const meta = metas[i];
    const media = meta.getAttribute('media') ?? '';
    meta.setAttribute('content', /dark/.test(media) ? colors.dark : colors.light);
  }
}
