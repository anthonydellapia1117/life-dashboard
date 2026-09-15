/**
 * LifeData schema - the full shape of the decrypted dashboard payload.
 *
 * Every tab component renders directly from a slice of this type. A tab
 * whose slice is missing or empty must render a quiet empty state rather
 * than throw, so treat every array/optional field here as something a
 * consumer has to check for length before rendering.
 *
 * Dates are always absolute ISO strings (YYYY-MM-DD, or full ISO 8601 with
 * an offset for timestamps). Never store relative words like "tomorrow" -
 * the UI computes relative labels ("in 3 days", "today", "overdue") live
 * from the current date at render time.
 */

export type Severity = 'urgent' | 'warning' | 'info';

export type Horizon = 'now' | 'week' | 'later' | 'routine';

/** Visual tone for a status pill, matching the prototype's pill classes. */
export type PillTone = 'live' | 'due' | 'soon' | 'done' | 'watch';

export type Visibility = 'public' | 'private';

export interface Meta {
  /** ISO 8601 timestamp with offset - when this data snapshot was generated. */
  asOf: string;
  /** Free-text description of how the data was produced. */
  generatedBy: string;
  /** Data sources feeding the snapshot, e.g. "Google Calendar", "Gmail". */
  sources: string[];
}

export interface Kpi {
  id: string;
  label: string;
  value: string;
}

export interface Alert {
  id: string;
  severity: Severity;
  text: string;
}

export interface ActionItem {
  id: string;
  title: string;
  detail?: string;
  horizon: Horizon;
  /** Short tag naming the life area this action belongs to, e.g. "Work". */
  area: string;
  /** Optional ISO date this action is anchored to, for future sorting. */
  due?: string;
}

export type CalendarStatus = 'done' | 'active' | 'urgent' | 'warning' | 'upcoming';

export interface CalendarEvent {
  id: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** Optional ISO time (HH:mm) or free-text time-of-day label. */
  time?: string;
  title: string;
  detail?: string;
  area?: string;
  /** Visual/lifecycle state, independent of the live "in N days" countdown. */
  state?: CalendarStatus;
}

/* ---------------------------------- Work --------------------------------- */

export interface Milestone {
  id: string;
  name: string;
  detail?: string;
  due: string;
  status: string;
  pill: PillTone;
}

export interface WorkEngagement {
  name: string;
  status: string;
  milestones: Milestone[];
  role: string;
  partner: string;
  team: string[];
  clientSponsor: string;
  scope: string;
}

export interface CompletedEngagement {
  id: string;
  project: string;
  detail?: string;
  role: string;
  status: string;
  pill: PillTone;
}

export interface WorkData {
  /** The tab's heading; kept in the data so the public code names no employer. */
  title?: string;
  summary: string;
  engagement: WorkEngagement;
  actionItems: ActionItem[];
  completed: CompletedEngagement[];
}

/* --------------------------------- Career --------------------------------- */

export interface TrackedItem {
  id: string;
  name: string;
  detail?: string;
  /** A figure beside the item; its column header comes from the data. */
  value?: string;
  status: string;
  pill: PillTone;
}

export interface LogEntry {
  id: string;
  date: string;
  name: string;
  detail: string;
  source: string;
}

export interface LabelledNote {
  label: string;
  text: string;
}

/**
 * Every heading and label of this tab comes from the (encrypted) data, so the
 * public code says nothing about what the tab tracks.
 */
export interface CareerData {
  title?: string;
  summary: string;
  kpis: Kpi[];
  labels?: {
    open?: string;
    openBadge?: string;
    value?: string;
    log?: string;
    logBadge?: string;
    logName?: string;
    logDetail?: string;
    closed?: string;
  };
  open: TrackedItem[];
  notes: LabelledNote[];
  log: LogEntry[];
  logNote?: string;
  closed: TrackedItem[];
}

/* ---------------------------------- UNICO --------------------------------- */

export interface Account {
  id: string;
  name: string;
  balance: number;
  notes?: string;
  highlight?: boolean;
}

export interface Contact {
  id: string;
  name: string;
  role: string;
  contact: string;
}

export interface UnicoData {
  summary: string;
  kpis: Kpi[];
  accounts: Account[];
  givingNote: string;
  actionItems: ActionItem[];
  events: CalendarEvent[];
  contacts: Contact[];
}

/* --------------------------------- Projects -------------------------------- */

export interface ProjectStat {
  label: string;
  value: string;
}

export interface ProjectCard {
  id: string;
  title: string;
  subtitle?: string;
  pill: PillTone;
  pillLabel: string;
  body: string;
  highlights?: string[];
  stats?: ProjectStat[];
  liveUrl?: string;
}

export interface RepoStatus {
  id: string;
  name: string;
  visibility: Visibility;
  status: string;
}

export interface ProjectsData {
  summary: string;
  cards: ProjectCard[];
  sportsCards: ProjectCard[];
  repos: RepoStatus[];
  repoNote?: string;
}

/* --------------------------------- Ayvede ---------------------------------- */

export interface StatusRow {
  id: string;
  item: string;
  detail?: string;
  status: string;
  pill: PillTone;
}

export interface NewsletterRow {
  id: string;
  item: string;
  detail: string;
}

export interface AyvedeData {
  summary: string;
  alerts: Alert[];
  status: StatusRow[];
  businessNote: string;
  newsletter: NewsletterRow[];
  newsletterNote: string;
}

/* --------------------------------- Family ---------------------------------- */

export interface FamilyRow {
  id: string;
  item: string;
  detail?: string;
  date: string;
  status: string;
  pill: PillTone;
}

export interface TripRow {
  id: string;
  item: string;
  detail: string;
}

export interface FamilyData {
  summary: string;
  child: FamilyRow[];
  childNote?: string;
  trip: TripRow[];
  tripNote?: string;
  health: FamilyRow[];
  healthNote?: string;
  milestones: CalendarEvent[];
  milestonesNote?: string;
}

/* -------------------------------- Finances ---------------------------------- */

export interface PaymentRow {
  id: string;
  item: string;
  detail?: string;
  amount?: number;
  due: string;
}

export interface SubscriptionRow {
  id: string;
  tool: string;
  status: string;
  pill: PillTone;
}

export interface OpenItemRow {
  id: string;
  item: string;
  detail?: string;
  status: string;
  pill: PillTone;
}

export interface FinancesData {
  summary: string;
  recurring: PaymentRow[];
  subscriptions: SubscriptionRow[];
  openItems: OpenItemRow[];
  accountsNote: string;
}

/* --------------------------------- AI Stack --------------------------------- */

export interface ToolRow {
  id: string;
  tool: string;
  detail?: string;
  role?: string;
  status: string;
  pill: PillTone;
}

export interface RemovedToolRow {
  id: string;
  tool: string;
  removed: string;
  reason: string;
}

export interface StackComponentRow {
  id: string;
  component: string;
  tool: string;
}

export interface AiStackData {
  summary: string;
  active: ToolRow[];
  removed: RemovedToolRow[];
  stack: StackComponentRow[];
  note: string;
}

/* ---------------------------------------------------------------------------- */

export interface LifeData {
  meta: Meta;
  kpis: Kpi[];
  alerts: Alert[];
  actions: ActionItem[];
  calendar: CalendarEvent[];
  work?: WorkData;
  career?: CareerData;
  unico?: UnicoData;
  projects?: ProjectsData;
  ayvede?: AyvedeData;
  family?: FamilyData;
  finances?: FinancesData;
  aiStack?: AiStackData;
}

export const TAB_IDS = [
  'overview',
  'work',
  'career',
  'unico',
  'projects',
  'ayvede',
  'family',
  'finances',
  'ai-stack',
] as const;

export type TabId = (typeof TAB_IDS)[number];

export const TAB_LABELS: Record<TabId, string> = {
  overview: 'Overview',
  work: 'Work',
  career: 'Career',
  unico: 'UNICO',
  projects: 'Projects',
  ayvede: 'Ayvede',
  family: 'Family',
  finances: 'Finances',
  'ai-stack': 'AI Stack',
};
