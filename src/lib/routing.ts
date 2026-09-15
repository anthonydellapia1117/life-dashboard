/**
 * Information architecture: 4 zones (Hick's law), each with a small
 * set of sections switched by a segmented control. Routing lives entirely in
 * the URL hash so the app is linkable/bookmarkable and back/forward works.
 *
 * Canonical hash shapes:
 *   #today
 *   #work/engagement | #work/career | #work/business
 *   #life/family | #life/finances | #life/community
 *   #build/projects | #build/ai-stack
 *
 * Every hash the previous flat-tab IA used (#overview, #work, #career,
 * #ayvede, #unico, #family, #finances, #projects, #ai-stack) still resolves,
 * via LEGACY_HASH_MAP, to its new home below.
 */

export type ZoneId = 'today' | 'work' | 'life' | 'build';

export type SectionId =
  | 'engagement'
  | 'career'
  | 'business'
  | 'family'
  | 'finances'
  | 'community'
  | 'projects'
  | 'ai-stack';

export interface Route {
  zone: ZoneId;
  section?: SectionId;
}

export const ZONE_IDS: ZoneId[] = ['today', 'work', 'life', 'build'];

export const ZONE_LABELS: Record<ZoneId, string> = {
  today: 'Today',
  work: 'Work',
  life: 'Life',
  build: 'Build',
};

export const SECTIONS_BY_ZONE: Record<ZoneId, SectionId[]> = {
  today: [],
  work: ['engagement', 'career', 'business'],
  life: ['family', 'finances', 'community'],
  build: ['projects', 'ai-stack'],
};

/** Neutral fallback heading for a section when the data carries no title of its own. */
export const SECTION_LABELS: Record<SectionId, string> = {
  engagement: 'Engagement',
  career: 'Career',
  business: 'Business',
  family: 'Family',
  finances: 'Finances',
  community: 'Community',
  projects: 'Projects',
  'ai-stack': 'AI stack',
};

/** Old flat-tab hash (no leading "#") -> new canonical path (no leading "#"). */
const LEGACY_HASH_MAP: Record<string, string> = {
  overview: 'today',
  work: 'work/engagement',
  career: 'work/career',
  ayvede: 'work/business',
  unico: 'life/community',
  family: 'life/family',
  finances: 'life/finances',
  projects: 'build/projects',
  'ai-stack': 'build/ai-stack',
};

function isZone(value: string): value is ZoneId {
  return (ZONE_IDS as string[]).includes(value);
}

function isSectionOf(zone: ZoneId, value: string): value is SectionId {
  return (SECTIONS_BY_ZONE[zone] as string[]).includes(value);
}

/**
 * Parse a location hash (with or without the leading "#") into a Route.
 * Never throws - anything unrecognized falls back to Today, and a
 * zone named with no (or an invalid) section opens its first section.
 */
export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '').trim();
  if (!raw) return { zone: 'today' };

  if (Object.prototype.hasOwnProperty.call(LEGACY_HASH_MAP, raw)) {
    return parseHash(LEGACY_HASH_MAP[raw]);
  }

  const [destRaw, sectionRaw] = raw.split('/');
  if (!destRaw || !isZone(destRaw)) return { zone: 'today' };
  const zone = destRaw;

  const sections = SECTIONS_BY_ZONE[zone];
  if (sections.length === 0) return { zone };
  if (sectionRaw && isSectionOf(zone, sectionRaw)) return { zone, section: sectionRaw };
  return { zone, section: sections[0] };
}

/** Serialize a Route back to its canonical hash string, e.g. "#work/career". */
export function routeToHash(route: Route): string {
  if (!route.section) return `#${route.zone}`;
  return `#${route.zone}/${route.section}`;
}
