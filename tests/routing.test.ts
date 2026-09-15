import { describe, expect, it } from 'vitest';
import { parseHash, routeToHash } from '../src/lib/routing';

describe('parseHash - canonical routes', () => {
  it('defaults to Today for an empty hash', () => {
    expect(parseHash('')).toEqual({ zone: 'today' });
    expect(parseHash('#')).toEqual({ zone: 'today' });
  });

  it('parses every canonical zone/section path', () => {
    expect(parseHash('#today')).toEqual({ zone: 'today' });
    expect(parseHash('#work/engagement')).toEqual({ zone: 'work', section: 'engagement' });
    expect(parseHash('#work/career')).toEqual({ zone: 'work', section: 'career' });
    expect(parseHash('#work/business')).toEqual({ zone: 'work', section: 'business' });
    expect(parseHash('#life/family')).toEqual({ zone: 'life', section: 'family' });
    expect(parseHash('#life/finances')).toEqual({ zone: 'life', section: 'finances' });
    expect(parseHash('#life/community')).toEqual({ zone: 'life', section: 'community' });
    expect(parseHash('#build/projects')).toEqual({ zone: 'build', section: 'projects' });
    expect(parseHash('#build/ai-stack')).toEqual({ zone: 'build', section: 'ai-stack' });
  });

  it('opens the first section when a zone has no section in the hash', () => {
    expect(parseHash('#work')).toEqual({ zone: 'work', section: 'engagement' });
    expect(parseHash('#life')).toEqual({ zone: 'life', section: 'family' });
    expect(parseHash('#build')).toEqual({ zone: 'build', section: 'projects' });
  });

  it('falls back to the first section for an invalid section on a real zone', () => {
    expect(parseHash('#work/nonsense')).toEqual({ zone: 'work', section: 'engagement' });
  });

  it('falls back to Today for anything unrecognized', () => {
    expect(parseHash('#bogus')).toEqual({ zone: 'today' });
    expect(parseHash('#life/bogus/extra')).toEqual({ zone: 'life', section: 'family' });
  });
});

describe('parseHash - every legacy hash maps to its new home', () => {
  const legacy: Array<[string, ReturnType<typeof parseHash>]> = [
    ['#overview', { zone: 'today' }],
    ['#work', { zone: 'work', section: 'engagement' }],
    ['#career', { zone: 'work', section: 'career' }],
    ['#ayvede', { zone: 'work', section: 'business' }],
    ['#unico', { zone: 'life', section: 'community' }],
    ['#family', { zone: 'life', section: 'family' }],
    ['#finances', { zone: 'life', section: 'finances' }],
    ['#projects', { zone: 'build', section: 'projects' }],
    ['#ai-stack', { zone: 'build', section: 'ai-stack' }],
  ];

  it.each(legacy)('%s', (hash, expected) => {
    expect(parseHash(hash)).toEqual(expected);
  });
});

describe('routeToHash', () => {
  it('round-trips every canonical route', () => {
    expect(routeToHash({ zone: 'today' })).toBe('#today');
    expect(routeToHash({ zone: 'work', section: 'business' })).toBe('#work/business');
    expect(routeToHash({ zone: 'life', section: 'community' })).toBe('#life/community');
    expect(routeToHash({ zone: 'build', section: 'ai-stack' })).toBe('#build/ai-stack');
  });

  it('re-parses to the same route it serialized (round trip)', () => {
    const routes = [
      { zone: 'today' as const },
      { zone: 'work' as const, section: 'career' as const },
      { zone: 'life' as const, section: 'finances' as const },
      { zone: 'build' as const, section: 'projects' as const },
    ];
    for (const route of routes) {
      expect(parseHash(routeToHash(route))).toEqual(route);
    }
  });
});
