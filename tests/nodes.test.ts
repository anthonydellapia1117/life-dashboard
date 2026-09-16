import { describe, expect, it } from 'vitest';
import { collectNodes, nodesById, nodesBySection } from '../src/lib/nodes';
import type { LifeData } from '../src/types';

/** Minimal valid LifeData - the required top-level slices only, every optional section absent. */
function baseData(overrides: Partial<LifeData> = {}): LifeData {
  return {
    meta: { asOf: '2020-01-01T09:00:00-05:00', generatedBy: 'Fixture', sources: ['Fixture'] },
    kpis: [],
    alerts: [],
    actions: [],
    calendar: [],
    ...overrides,
  };
}

/** One populated row (or two, where a pair is needed) per slice the spec lists, all fictional. */
function fullData(): LifeData {
  return {
    meta: { asOf: '2020-01-01T09:00:00-05:00', generatedBy: 'Fixture', sources: ['Fixture'] },
    kpis: [],
    alerts: [{ id: 'a1', severity: 'info', text: 'Alert one' }],
    actions: [{ id: 'act1', title: 'Action one', horizon: 'now', area: 'Area A', due: '2020-01-05' }],
    calendar: [{ id: 'cal1', date: '2020-01-06', title: 'Event one', area: 'Area B' }],
    work: {
      summary: 'Summary',
      engagement: {
        name: 'Engagement one',
        status: 'Active',
        milestones: [{ id: 'm1', name: 'Milestone one', due: '2020-02-01', status: 'On track', pill: 'live' }],
        role: 'Role',
        partner: 'Partner',
        team: ['Person A'],
        clientSponsor: 'Sponsor',
        scope: 'Scope',
      },
      actionItems: [{ id: 'wa1', title: 'Work action one', horizon: 'week', area: 'Work' }],
      completed: [{ id: 'wc1', project: 'Project one', role: 'Role', status: 'Wrapped', pill: 'done' }],
    },
    career: {
      summary: 'Summary',
      kpis: [],
      open: [{ id: 'co1', name: 'Open one', status: 'Status A', pill: 'watch' }],
      notes: [],
      log: [{ id: 'cl1', date: '2020-01-02', name: 'Log one', detail: 'Detail', source: 'Source A' }],
      closed: [{ id: 'cc1', name: 'Closed one', status: 'Closed', pill: 'done' }],
    },
    unico: {
      summary: 'Summary',
      kpis: [],
      accounts: [{ id: 'ua1', name: 'Account one', balance: 500 }],
      givingNote: 'Note',
      actionItems: [{ id: 'ui1', title: 'Community action one', horizon: 'later', area: 'Community' }],
      events: [{ id: 'ue1', date: '2020-03-01', title: 'Community event one' }],
      contacts: [],
    },
    projects: {
      summary: 'Summary',
      cards: [{ id: 'pc1', title: 'Card one', subtitle: 'Subtitle one', pill: 'live', pillLabel: 'Live', body: 'Body' }],
      sportsCards: [{ id: 'ps1', title: 'Sports card one', pill: 'watch', pillLabel: 'Watching', body: 'Body' }],
      repos: [{ id: 'pr1', name: 'Repo one', visibility: 'public', status: 'Active' }],
    },
    ayvede: {
      summary: 'Summary',
      alerts: [],
      status: [{ id: 'as1', item: 'Status one', status: 'Live', pill: 'live' }],
      businessNote: 'Note',
      newsletter: [{ id: 'an1', item: 'Newsletter one', detail: 'Detail' }],
      newsletterNote: 'Note',
    },
    family: {
      summary: 'Summary',
      child: [{ id: 'fc1', item: 'Child item one', date: '2020-04-01', status: 'Scheduled', pill: 'soon' }],
      trip: [{ id: 'ft1', item: 'Trip one', detail: 'Detail' }],
      health: [{ id: 'fh1', item: 'Health item one', date: '2020-05-01', status: 'Due', pill: 'due' }],
      milestones: [{ id: 'fm1', date: '2020-06-01', title: 'Family milestone one' }],
    },
    finances: {
      summary: 'Summary',
      recurring: [{ id: 'fr1', item: 'Payment one', due: '2020-01-10', amount: 100 }],
      subscriptions: [{ id: 'fs1', tool: 'Tool one', status: 'Active', pill: 'live' }],
      openItems: [{ id: 'fo1', item: 'Open item one', status: 'Pending', pill: 'watch' }],
      accountsNote: 'Note',
    },
    aiStack: {
      summary: 'Summary',
      active: [{ id: 'aa1', tool: 'Tool A', status: 'Active', pill: 'live' }],
      removed: [{ id: 'ar1', tool: 'Tool B', removed: '2020-01-15', reason: 'Replaced' }],
      stack: [{ id: 'ast1', component: 'Component one', tool: 'Tool C' }],
      note: 'Note',
    },
  };
}

const EXPECTED_SOURCES = [
  'actions', 'calendar', 'alerts',
  'work.actionItems', 'work.engagement.milestones', 'work.completed',
  'career.open', 'career.closed', 'career.log',
  'unico.actionItems', 'unico.events', 'unico.accounts',
  'projects.cards', 'projects.sportsCards', 'projects.repos',
  'ayvede.status', 'ayvede.newsletter',
  'family.child', 'family.health', 'family.trip', 'family.milestones',
  'finances.recurring', 'finances.subscriptions', 'finances.openItems',
  'aiStack.active', 'aiStack.removed', 'aiStack.stack',
];

const ZONE_SECTION_CASES: Array<[string, string, string | undefined]> = [
  ['actions:act1', 'today', undefined],
  ['calendar:cal1', 'today', undefined],
  ['alerts:a1', 'today', undefined],
  ['work.actionItems:wa1', 'work', 'engagement'],
  ['work.engagement.milestones:m1', 'work', 'engagement'],
  ['work.completed:wc1', 'work', 'engagement'],
  ['career.open:co1', 'work', 'career'],
  ['career.closed:cc1', 'work', 'career'],
  ['career.log:cl1', 'work', 'career'],
  ['unico.actionItems:ui1', 'life', 'community'],
  ['unico.events:ue1', 'life', 'community'],
  ['unico.accounts:ua1', 'life', 'community'],
  ['projects.cards:pc1', 'build', 'projects'],
  ['projects.sportsCards:ps1', 'build', 'projects'],
  ['projects.repos:pr1', 'build', 'projects'],
  ['ayvede.status:as1', 'work', 'business'],
  ['ayvede.newsletter:an1', 'work', 'business'],
  ['family.child:fc1', 'life', 'family'],
  ['family.health:fh1', 'life', 'family'],
  ['family.trip:ft1', 'life', 'family'],
  ['family.milestones:fm1', 'life', 'family'],
  ['finances.recurring:fr1', 'life', 'finances'],
  ['finances.subscriptions:fs1', 'life', 'finances'],
  ['finances.openItems:fo1', 'life', 'finances'],
  ['aiStack.active:aa1', 'build', 'ai-stack'],
  ['aiStack.removed:ar1', 'build', 'ai-stack'],
  ['aiStack.stack:ast1', 'build', 'ai-stack'],
];

const nodes = collectNodes(fullData());
const index = nodesById(nodes);

describe('collectNodes - missing and empty slices', () => {
  it('returns [] when every optional slice is absent', () => {
    expect(collectNodes(baseData())).toEqual([]);
  });

  it('returns [] when optional sections are present but every array inside them is empty', () => {
    const data = baseData({
      work: {
        summary: 'Summary',
        engagement: {
          name: 'Engagement',
          status: 'Active',
          milestones: [],
          role: 'Role',
          partner: 'Partner',
          team: [],
          clientSponsor: 'Sponsor',
          scope: 'Scope',
        },
        actionItems: [],
        completed: [],
      },
      aiStack: { summary: 'Summary', active: [], removed: [], stack: [], note: 'Note' },
    });
    expect(collectNodes(data)).toEqual([]);
  });
});

describe('collectNodes - every documented slice emits a node', () => {
  it('has at least one node for every slice source in the spec', () => {
    for (const source of EXPECTED_SOURCES) {
      expect(nodes.some((n) => n.source === source), `missing a node for source "${source}"`).toBe(true);
    }
  });
});

describe('collectNodes - ids are unique', () => {
  it('produces unique ids across a fixture covering every slice in the real schema', () => {
    const ids = nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps ids distinct when different slices reuse the same raw id', () => {
    const data = baseData({
      actions: [{ id: '1', title: 'Action', horizon: 'now', area: 'Area A' }],
      calendar: [{ id: '1', date: '2020-01-01', title: 'Event' }],
      alerts: [{ id: '1', severity: 'info', text: 'Alert' }],
    });
    const ids = collectNodes(data).map((n) => n.id);
    expect(ids).toEqual(['actions:1', 'calendar:1', 'alerts:1']);
    expect(new Set(ids).size).toBe(3);
  });
});

describe('collectNodes - zone/section mapping', () => {
  it.each(ZONE_SECTION_CASES)('%s -> zone %s, section %s', (id, zone, section) => {
    const node = index.get(id);
    expect(node).toBeDefined();
    expect(node?.zone).toBe(zone);
    expect(node?.section).toBe(section);
  });
});

describe('collectNodes - area fallback', () => {
  it('uses the row own area when it has one, and the section fallback word otherwise', () => {
    expect(index.get('actions:act1')?.area).toBe('Area A'); // ActionItem always carries its own area
    expect(index.get('alerts:a1')?.area).toBe('Alerts'); // Alert has no area field at all
    expect(index.get('work.engagement.milestones:m1')?.area).toBe('Work'); // Milestone has no area field
    expect(index.get('unico.events:ue1')?.area).toBe('Community'); // CalendarEvent.area left unset
  });
});

describe('collectNodes - baseDone', () => {
  it('is true only when the row pill is done', () => {
    expect(index.get('work.completed:wc1')?.baseDone).toBe(true);
    expect(index.get('career.closed:cc1')?.baseDone).toBe(true);
    expect(index.get('career.open:co1')?.baseDone).toBe(false);
    expect(index.get('work.engagement.milestones:m1')?.baseDone).toBe(false);
  });

  it('is true for a calendar event whose state is done, false otherwise', () => {
    const data = baseData({
      calendar: [
        { id: 'done1', date: '2020-01-01', title: 'Done event', state: 'done' },
        { id: 'open1', date: '2020-01-02', title: 'Open event', state: 'upcoming' },
      ],
    });
    const idx = nodesById(collectNodes(data));
    expect(idx.get('calendar:done1')?.baseDone).toBe(true);
    expect(idx.get('calendar:open1')?.baseDone).toBe(false);
  });
});

describe('collectNodes - due date parsing', () => {
  it('drops a free-text due date but keeps a valid ISO date', () => {
    const data = baseData({
      actions: [
        { id: 'good', title: 'Good', horizon: 'now', area: 'Area A', due: '2021-02-03' },
        { id: 'bad', title: 'Bad', horizon: 'now', area: 'Area A', due: 'next week sometime' },
      ],
    });
    const idx = nodesById(collectNodes(data));
    expect(idx.get('actions:good')?.due).toBe('2021-02-03');
    expect(idx.get('actions:bad')?.due).toBeUndefined();
  });

  it('keeps aiStack.removed as a due date only when it parses as YYYY-MM-DD', () => {
    expect(index.get('aiStack.removed:ar1')?.due).toBe('2020-01-15');

    const data = baseData({
      aiStack: {
        summary: 'S',
        active: [],
        removed: [{ id: 'r2', tool: 'Tool Y', removed: 'sometime last year', reason: 'Sunset' }],
        stack: [],
        note: 'Note',
      },
    });
    expect(nodesById(collectNodes(data)).get('aiStack.removed:r2')?.due).toBeUndefined();
  });

  it('truncates a full ISO timestamp with an offset to its date prefix', () => {
    const data = baseData({
      finances: {
        summary: 'S',
        recurring: [{ id: 'p1', item: 'Payment', due: '2022-03-04T00:00:00-05:00', amount: 42 }],
        subscriptions: [],
        openItems: [],
        accountsNote: 'Note',
      },
    });
    expect(nodesById(collectNodes(data)).get('finances.recurring:p1')?.due).toBe('2022-03-04');
  });
});

describe('collectNodes - amount', () => {
  it('carries Account.balance and PaymentRow.amount as amount', () => {
    expect(index.get('unico.accounts:ua1')?.amount).toBe(500);
    expect(index.get('finances.recurring:fr1')?.amount).toBe(100);
    expect(index.get('career.open:co1')?.amount).toBeUndefined();
  });
});

describe('nodesById', () => {
  it('indexes every node by its id', () => {
    expect(index.size).toBe(nodes.length);
    expect(index.get('actions:act1')?.title).toBe('Action one');
  });
});

describe('nodesBySection', () => {
  it('groups nodes under `${zone}/${section ?? \'\'}`, top-level slices keyed with an empty section', () => {
    const groups = nodesBySection(nodes);
    expect(groups.get('today/')?.some((n) => n.id === 'actions:act1')).toBe(true);
    expect(groups.get('work/engagement')?.some((n) => n.id === 'work.actionItems:wa1')).toBe(true);
    expect(groups.get('life/community')?.some((n) => n.id === 'unico.accounts:ua1')).toBe(true);
    expect(groups.get('build/ai-stack')?.some((n) => n.id === 'aiStack.stack:ast1')).toBe(true);
  });
});
