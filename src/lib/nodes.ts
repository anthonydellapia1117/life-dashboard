/**
 * Universal item model: one LifeNode per heterogeneous row in LifeData, so a
 * single board/timeline/graph view can count, group, and check off any of it
 * without switching on the source type at render time.
 *
 * collectNodes walks exactly the slices this app treats as items (see the
 * calls inside it). kpis, career.notes, unico.contacts and ayvede.alerts are
 * intentionally not walked - notes/contacts carry no id to key a node on, and
 * kpis are metrics, not items, so no NodeKind fits any of them.
 *
 * Every slice access here tolerates the slice being missing or empty, per
 * src/types.ts's own contract for consumers - this module never throws.
 *
 * "Done" as modeled here (baseDone) is only ever the sealed base row's own
 * state (a PillTone of 'done', or a CalendarEvent state of 'done'). Overlay
 * edits - the user checking something off later - live in src/lib/edits.ts
 * and src/lib/live.ts, layered on top of a LifeNode; they are out of scope
 * here on purpose.
 */

import type {
  Account,
  ActionItem,
  Alert,
  CalendarEvent,
  CompletedEngagement,
  FamilyRow,
  LifeData,
  LogEntry,
  Milestone,
  NewsletterRow,
  OpenItemRow,
  PaymentRow,
  ProjectCard,
  RemovedToolRow,
  RepoStatus,
  StackComponentRow,
  StatusRow,
  SubscriptionRow,
  ToolRow,
  TrackedItem,
  TripRow,
} from '../types';
import type { SectionId, ZoneId } from './routing';

export type NodeKind =
  | 'action' | 'event' | 'milestone' | 'tracked' | 'logged'
  | 'status' | 'payment' | 'subscription' | 'account'
  | 'project' | 'repo' | 'tool' | 'note';

export interface LifeNode {
  /** Globally unique. Always `${source}:${rawId}` where source is the slice path, e.g. "work.actionItems". */
  id: string;
  /** The item's own id inside its slice. */
  rawId: string;
  /** Slice path this came from, e.g. "actions", "work.engagement.milestones", "finances.recurring". */
  source: string;
  kind: NodeKind;
  title: string;
  detail?: string;
  /** Life area tag for grouping/colour. Falls back to the section label when the row carries no area. */
  area: string;
  /** Zone id from src/lib/routing.ts: 'today' | 'work' | 'life' | 'build'. */
  zone: string;
  /** Section id from src/lib/routing.ts, undefined for top-level slices (actions, calendar, kpis, alerts). */
  section?: string;
  /** ISO YYYY-MM-DD if the row carries a date of any kind (due, date, removed). */
  due?: string;
  /** 'now' | 'week' | 'later' | 'routine' when the row has one. */
  horizon?: string;
  /** Free-text status string from the row, when it has one. */
  status?: string;
  /** PillTone from the row, when it has one. */
  pill?: string;
  /** True when the underlying row already reads as complete: pill === 'done', or a CalendarEvent state === 'done'. Overlay edits layer on top of this elsewhere - do not model them here. */
  baseDone: boolean;
  /** Numeric figure carried by the row (Account.balance, PaymentRow.amount), when present. */
  amount?: number;
}

/** Where a slice's nodes live in the 4-zone IA, and the fallback area word for rows that carry none of their own. */
interface Place {
  zone: ZoneId;
  section?: SectionId;
  area: string;
}

type PlaceKey =
  | 'actions' | 'calendar' | 'alerts'
  | 'work' | 'career' | 'ayvede'
  | 'family' | 'finances' | 'unico'
  | 'projects' | 'aiStack';

/**
 * One row per top-level data namespace. Zone/section here must match
 * src/lib/routing.ts exactly: work -> engagement/career/business,
 * life -> family/finances/community, build -> projects/ai-stack. The area
 * word is generic UI vocabulary only, never anything derived from data.
 */
const PLACE: Record<PlaceKey, Place> = {
  actions: { zone: 'today', area: 'Inbox' },
  calendar: { zone: 'today', area: 'Calendar' },
  alerts: { zone: 'today', area: 'Alerts' },
  work: { zone: 'work', section: 'engagement', area: 'Work' },
  career: { zone: 'work', section: 'career', area: 'Career' },
  ayvede: { zone: 'work', section: 'business', area: 'Business' },
  family: { zone: 'life', section: 'family', area: 'Family' },
  finances: { zone: 'life', section: 'finances', area: 'Finances' },
  unico: { zone: 'life', section: 'community', area: 'Community' },
  projects: { zone: 'build', section: 'projects', area: 'Projects' },
  aiStack: { zone: 'build', section: 'ai-stack', area: 'AI stack' },
};

const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;

/** The YYYY-MM-DD prefix of `value` if it starts with one, else undefined - free text is dropped. */
function toDue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const match = ISO_DATE_PREFIX.exec(value);
  return match ? match[0] : undefined;
}

interface NodeFields {
  area?: string;
  detail?: string;
  due?: string;
  horizon?: string;
  status?: string;
  pill?: string;
  baseDone?: boolean;
  amount?: number;
}

function makeNode(
  source: string,
  rawId: string,
  kind: NodeKind,
  title: string,
  place: Place,
  fields: NodeFields = {},
): LifeNode {
  return {
    id: `${source}:${rawId}`,
    rawId,
    source,
    kind,
    title,
    detail: fields.detail,
    area: fields.area || place.area,
    zone: place.zone,
    section: place.section,
    due: fields.due,
    horizon: fields.horizon,
    status: fields.status,
    pill: fields.pill,
    baseDone: fields.baseDone ?? false,
    amount: fields.amount,
  };
}

/** Push one LifeNode per item onto `nodes`. A missing array contributes nothing. */
function addAll<T>(nodes: LifeNode[], items: T[] | undefined, mapper: (item: T) => LifeNode): void {
  for (const item of items ?? []) nodes.push(mapper(item));
}

/* ------------------------------- Row mappers ------------------------------ */
/* One mapper per row shape, reused across every slice that carries that shape. */

function fromActionItem(source: string, place: Place) {
  return (item: ActionItem): LifeNode =>
    makeNode(source, item.id, 'action', item.title, place, {
      area: item.area,
      detail: item.detail,
      due: toDue(item.due),
      horizon: item.horizon,
    });
}

function fromCalendarEvent(source: string, place: Place) {
  return (item: CalendarEvent): LifeNode =>
    makeNode(source, item.id, 'event', item.title, place, {
      area: item.area,
      detail: item.detail,
      due: toDue(item.date),
      // The event's lifecycle field doubles as this row's free-text status.
      status: item.state,
      baseDone: item.state === 'done',
    });
}

function fromAlert(place: Place) {
  return (item: Alert): LifeNode => makeNode('alerts', item.id, 'note', item.text, place);
}

function fromMilestone(source: string, place: Place) {
  return (item: Milestone): LifeNode =>
    makeNode(source, item.id, 'milestone', item.name, place, {
      detail: item.detail,
      due: toDue(item.due),
      status: item.status,
      pill: item.pill,
      baseDone: item.pill === 'done',
    });
}

function fromCompletedEngagement(source: string, place: Place) {
  return (item: CompletedEngagement): LifeNode =>
    makeNode(source, item.id, 'status', item.project, place, {
      detail: item.detail,
      status: item.status,
      pill: item.pill,
      baseDone: item.pill === 'done',
    });
}

function fromTrackedItem(source: string, place: Place) {
  return (item: TrackedItem): LifeNode =>
    makeNode(source, item.id, 'tracked', item.name, place, {
      detail: item.detail,
      status: item.status,
      pill: item.pill,
      baseDone: item.pill === 'done',
    });
}

function fromLogEntry(source: string, place: Place) {
  return (item: LogEntry): LifeNode =>
    makeNode(source, item.id, 'logged', item.name, place, {
      detail: item.detail,
      due: toDue(item.date),
    });
}

function fromAccount(source: string, place: Place) {
  return (item: Account): LifeNode =>
    makeNode(source, item.id, 'account', item.name, place, {
      detail: item.notes,
      amount: item.balance,
    });
}

function fromProjectCard(source: string, place: Place) {
  return (item: ProjectCard): LifeNode =>
    makeNode(source, item.id, 'project', item.title, place, {
      detail: item.subtitle,
      // pillLabel is the row's own free-text status label (e.g. "Live", "Building").
      status: item.pillLabel,
      pill: item.pill,
      baseDone: item.pill === 'done',
    });
}

function fromRepoStatus(source: string, place: Place) {
  return (item: RepoStatus): LifeNode =>
    makeNode(source, item.id, 'repo', item.name, place, {
      status: item.status,
    });
}

function fromStatusRow(source: string, place: Place) {
  return (item: StatusRow): LifeNode =>
    makeNode(source, item.id, 'status', item.item, place, {
      detail: item.detail,
      status: item.status,
      pill: item.pill,
      baseDone: item.pill === 'done',
    });
}

function fromNewsletterRow(source: string, place: Place) {
  return (item: NewsletterRow): LifeNode =>
    makeNode(source, item.id, 'note', item.item, place, { detail: item.detail });
}

function fromFamilyRow(source: string, place: Place) {
  return (item: FamilyRow): LifeNode =>
    makeNode(source, item.id, 'status', item.item, place, {
      detail: item.detail,
      due: toDue(item.date),
      status: item.status,
      pill: item.pill,
      baseDone: item.pill === 'done',
    });
}

function fromTripRow(source: string, place: Place) {
  return (item: TripRow): LifeNode =>
    makeNode(source, item.id, 'note', item.item, place, { detail: item.detail });
}

function fromPaymentRow(source: string, place: Place) {
  return (item: PaymentRow): LifeNode =>
    makeNode(source, item.id, 'payment', item.item, place, {
      detail: item.detail,
      due: toDue(item.due),
      amount: item.amount,
    });
}

function fromSubscriptionRow(source: string, place: Place) {
  return (item: SubscriptionRow): LifeNode =>
    makeNode(source, item.id, 'subscription', item.tool, place, {
      status: item.status,
      pill: item.pill,
      baseDone: item.pill === 'done',
    });
}

function fromOpenItemRow(source: string, place: Place) {
  return (item: OpenItemRow): LifeNode =>
    makeNode(source, item.id, 'status', item.item, place, {
      detail: item.detail,
      status: item.status,
      pill: item.pill,
      baseDone: item.pill === 'done',
    });
}

function fromToolRow(source: string, place: Place) {
  return (item: ToolRow): LifeNode =>
    makeNode(source, item.id, 'tool', item.tool, place, {
      detail: item.detail,
      status: item.status,
      pill: item.pill,
      baseDone: item.pill === 'done',
    });
}

function fromRemovedToolRow(source: string, place: Place) {
  return (item: RemovedToolRow): LifeNode =>
    makeNode(source, item.id, 'tool', item.tool, place, {
      detail: item.reason,
      due: toDue(item.removed),
    });
}

function fromStackComponentRow(source: string, place: Place) {
  return (item: StackComponentRow): LifeNode =>
    makeNode(source, item.id, 'note', item.component, place, { detail: item.tool });
}

/* --------------------------------- Collect --------------------------------- */

/**
 * Walk every item-shaped slice of LifeData into one flat LifeNode[]. A
 * missing or empty slice contributes nothing; this never throws.
 */
export function collectNodes(data: LifeData): LifeNode[] {
  const nodes: LifeNode[] = [];

  addAll(nodes, data.actions, fromActionItem('actions', PLACE.actions));
  addAll(nodes, data.calendar, fromCalendarEvent('calendar', PLACE.calendar));
  addAll(nodes, data.alerts, fromAlert(PLACE.alerts));

  addAll(nodes, data.work?.actionItems, fromActionItem('work.actionItems', PLACE.work));
  addAll(nodes, data.work?.engagement?.milestones, fromMilestone('work.engagement.milestones', PLACE.work));
  addAll(nodes, data.work?.completed, fromCompletedEngagement('work.completed', PLACE.work));

  addAll(nodes, data.career?.open, fromTrackedItem('career.open', PLACE.career));
  addAll(nodes, data.career?.closed, fromTrackedItem('career.closed', PLACE.career));
  addAll(nodes, data.career?.log, fromLogEntry('career.log', PLACE.career));

  addAll(nodes, data.unico?.actionItems, fromActionItem('unico.actionItems', PLACE.unico));
  addAll(nodes, data.unico?.events, fromCalendarEvent('unico.events', PLACE.unico));
  addAll(nodes, data.unico?.accounts, fromAccount('unico.accounts', PLACE.unico));

  addAll(nodes, data.projects?.cards, fromProjectCard('projects.cards', PLACE.projects));
  addAll(nodes, data.projects?.sportsCards, fromProjectCard('projects.sportsCards', PLACE.projects));
  addAll(nodes, data.projects?.repos, fromRepoStatus('projects.repos', PLACE.projects));

  addAll(nodes, data.ayvede?.status, fromStatusRow('ayvede.status', PLACE.ayvede));
  addAll(nodes, data.ayvede?.newsletter, fromNewsletterRow('ayvede.newsletter', PLACE.ayvede));

  addAll(nodes, data.family?.child, fromFamilyRow('family.child', PLACE.family));
  addAll(nodes, data.family?.health, fromFamilyRow('family.health', PLACE.family));
  addAll(nodes, data.family?.trip, fromTripRow('family.trip', PLACE.family));
  addAll(nodes, data.family?.milestones, fromCalendarEvent('family.milestones', PLACE.family));

  addAll(nodes, data.finances?.recurring, fromPaymentRow('finances.recurring', PLACE.finances));
  addAll(nodes, data.finances?.subscriptions, fromSubscriptionRow('finances.subscriptions', PLACE.finances));
  addAll(nodes, data.finances?.openItems, fromOpenItemRow('finances.openItems', PLACE.finances));

  addAll(nodes, data.aiStack?.active, fromToolRow('aiStack.active', PLACE.aiStack));
  addAll(nodes, data.aiStack?.removed, fromRemovedToolRow('aiStack.removed', PLACE.aiStack));
  addAll(nodes, data.aiStack?.stack, fromStackComponentRow('aiStack.stack', PLACE.aiStack));

  return nodes;
}

/** Index nodes by id - last write wins if ids somehow collide. */
export function nodesById(nodes: LifeNode[]): Map<string, LifeNode> {
  const map = new Map<string, LifeNode>();
  for (const node of nodes) map.set(node.id, node);
  return map;
}

/** Group nodes by zone/section, keyed `${zone}/${section ?? ''}` - top-level slices key on `${zone}/`. */
export function nodesBySection(nodes: LifeNode[]): Map<string, LifeNode[]> {
  const map = new Map<string, LifeNode[]>();
  for (const node of nodes) {
    const key = `${node.zone}/${node.section ?? ''}`;
    const list = map.get(key);
    if (list) list.push(node);
    else map.set(key, [node]);
  }
  return map;
}
