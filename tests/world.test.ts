import { describe, expect, it } from 'vitest';
import { SECTIONS_BY_ZONE, ZONE_IDS } from '../src/lib/routing';
import { THEME_COLORS, WORLDS, applyWorld, worldFor, type World } from '../src/lib/world';

function fakeDoc() {
  const attrs: Record<string, string> = {};
  const metas = [
    { attrs: { name: 'theme-color', media: '(prefers-color-scheme: light)', content: '#F2F2F7' } as Record<string, string> },
    { attrs: { name: 'theme-color', media: '(prefers-color-scheme: dark)', content: '#000000' } as Record<string, string> },
  ].map((m) => ({
    getAttribute: (n: string) => (n in m.attrs ? m.attrs[n] : null),
    setAttribute: (n: string, v: string) => {
      m.attrs[n] = v;
    },
    attrs: m.attrs,
  }));
  return {
    attrs,
    metas,
    documentElement: {
      setAttribute: (n: string, v: string) => {
        attrs[n] = v;
      },
    },
    querySelectorAll: (sel: string) => (sel === 'meta[name="theme-color"]' ? metas : []),
  };
}

describe('worldFor', () => {
  it('maps every zone and section to its world', () => {
    const expected: Record<string, World> = {
      lifeos: 'neutral',
      today: 'neutral',
      'work/engagement': 'work',
      'work/career': 'work',
      'work/business': 'ayvede',
      'life/family': 'life',
      'life/finances': 'life',
      'life/community': 'life',
      'build/projects': 'build',
      'build/ai-stack': 'build',
      'map/board': 'neutral',
      'map/roadmap': 'neutral',
      'map/brain': 'neutral',
      'map/progress': 'neutral',
      claude: 'claude',
    };
    const seen: string[] = [];
    for (const zone of ZONE_IDS) {
      const sections = SECTIONS_BY_ZONE[zone];
      if (sections.length === 0) {
        seen.push(zone);
        expect(worldFor(zone)).toBe(expected[zone]);
      }
      for (const s of sections) {
        seen.push(`${zone}/${s}`);
        expect(worldFor(zone, s)).toBe(expected[`${zone}/${s}`]);
      }
    }
    expect(seen.sort()).toEqual(Object.keys(expected).sort());
  });

  it('falls back to neutral for anything unknown', () => {
    expect(worldFor('nowhere')).toBe('neutral');
    expect(worldFor('work', 'nonsense')).toBe('neutral');
    expect(worldFor('')).toBe('neutral');
  });

  it('gives every world a light and a dark theme colour', () => {
    for (const w of WORLDS) {
      expect(THEME_COLORS[w].light).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(THEME_COLORS[w].dark).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe('applyWorld', () => {
  it('sets data-world on the root element', () => {
    const doc = fakeDoc();
    applyWorld(doc, 'life');
    expect(doc.attrs['data-world']).toBe('life');
  });

  it('rewrites the light and the dark theme-color metas with their own steps', () => {
    const doc = fakeDoc();
    applyWorld(doc, 'work');
    expect(doc.metas[0].attrs.content).toBe(THEME_COLORS.work.light);
    expect(doc.metas[1].attrs.content).toBe(THEME_COLORS.work.dark);
    applyWorld(doc, 'claude');
    expect(doc.metas[0].attrs.content).toBe('#faf9f5');
    expect(doc.metas[1].attrs.content).toBe('#141413');
  });

  it('returns to the Apple neutrals when switching back', () => {
    const doc = fakeDoc();
    applyWorld(doc, 'build');
    applyWorld(doc, 'neutral');
    expect(doc.attrs['data-world']).toBe('neutral');
    expect(doc.metas[0].attrs.content).toBe('#F2F2F7');
    expect(doc.metas[1].attrs.content).toBe('#000000');
  });
});
