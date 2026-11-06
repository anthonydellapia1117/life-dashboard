/**
 * Life OS buckets - six lanes every item sorts into.
 *
 * A bucket is a category, never an urgency: "when" is still only said by
 * src/lib/grade.ts. Colours live as --bucket-N tokens in global.css (light and
 * dark); nothing outside that file names a bucket colour.
 *
 * An item carries a bucket only if its row says so (optional `bucket` 1-6).
 * Otherwise it is inferred from its area, title, detail and where it lives.
 * Pure: no React, no DOM.
 */

export type BucketId = 1 | 2 | 3 | 4 | 5 | 6;

export interface BucketMeta {
  id: BucketId;
  name: string;
  /** CSS custom property holding this bucket's colour. */
  token: string;
  /** Class that sets --bucket for a chip, pill or stripe. */
  className: string;
}

export const BUCKETS: BucketMeta[] = [
  { id: 1, name: 'Me', token: '--bucket-1', className: 'bucket-1' },
  { id: 2, name: 'Family', token: '--bucket-2', className: 'bucket-2' },
  { id: 3, name: 'Career & Network', token: '--bucket-3', className: 'bucket-3' },
  { id: 4, name: 'Money Ventures', token: '--bucket-4', className: 'bucket-4' },
  { id: 5, name: 'Bills & Finances', token: '--bucket-5', className: 'bucket-5' },
  { id: 6, name: 'Work', token: '--bucket-6', className: 'bucket-6' },
];

export function bucketMeta(id: BucketId): BucketMeta {
  return BUCKETS[id - 1];
}

/** Checked in this order: the first rule that matches wins. */
const RULES: Array<[BucketId, RegExp]> = [
  [5, /\b(financ\w*|bills?|subscriptions?|tax(es)?|mortgage|utilit(y|ies))\b/i],
  [6, /\b(gt|work|client|engagement|pmo|consulting|deliverable)\b/i],
  [4, /\b(ayvede|mario|side projects?|martibot|passive income|clawback)\b/i],
  [3, /\b(job|resume|networking|unico|linkedin|recruiters?)\b/i],
  [2, /\b(alexa|andi|pollo|house|family|trips?|birthday)\b/i],
];

/** Where an item lives, as a fallback when its words say nothing (routing.ts section ids). */
const SECTION_BUCKET: Record<string, BucketId> = {
  finances: 5,
  engagement: 6,
  business: 4,
  projects: 4,
  career: 3,
  community: 3,
  family: 2,
};

export interface BucketInput {
  bucket?: number;
  area?: string;
  title?: string;
  detail?: string;
  section?: string;
}

function isBucketId(n: unknown): n is BucketId {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 6;
}

export function bucketOf(item: BucketInput): BucketId {
  if (isBucketId(item.bucket)) return item.bucket;
  const text = [item.area, item.title, item.detail].filter(Boolean).join(' ');
  for (const [id, re] of RULES) if (re.test(text)) return id;
  if (item.section && Object.prototype.hasOwnProperty.call(SECTION_BUCKET, item.section)) {
    return SECTION_BUCKET[item.section];
  }
  return 1;
}

/** Count per bucket for a list of items. Every bucket is present, zero if empty. */
export function countByBucket<T extends BucketInput>(items: T[]): Record<BucketId, number> {
  const out: Record<BucketId, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const item of items) out[bucketOf(item)] += 1;
  return out;
}
