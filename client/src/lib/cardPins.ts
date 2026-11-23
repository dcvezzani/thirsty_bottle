import type { Ability, MetaType, MetaValue } from '@vct/shared';

/**
 * Remembered ("pinned") values for the deck editor's New card form.
 * Kept per deck in this browser only: never part of the deck draft or a saved version.
 * A scalar key being present means that field is pinned; its value is what pre-fills the next new card.
 */
export type MetaRow = { key: string; type: MetaType; value: string };
export type CardPins = {
  name?: string;
  count?: string;
  description?: string;
  front?: string | null;
  back?: string | null;
  props: MetaRow[];
  abilities: Ability[];
};
export type ScalarPin = 'name' | 'count' | 'description' | 'front' | 'back';

const key = (deckId: string) => `vct.cardPins.${deckId}`;
const memory = new Map<string, CardPins>();
const empty = (): CardPins => ({ props: [], abilities: [] });

export function loadPins(deckId: string): CardPins {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key(deckId));
  } catch {
    // Storage unavailable: pins last only for this page session.
    return structuredClone(memory.get(deckId) ?? empty());
  }
  try {
    const p = raw ? JSON.parse(raw) : null;
    if (p && typeof p === 'object') return { ...p, props: Array.isArray(p.props) ? p.props : [], abilities: Array.isArray(p.abilities) ? p.abilities : [] };
  } catch {
    /* corrupt entry: start fresh */
  }
  return empty();
}

export function savePins(deckId: string, pins: CardPins) {
  memory.set(deckId, structuredClone(pins));
  try {
    localStorage.setItem(key(deckId), JSON.stringify(pins));
  } catch {
    /* in-memory only */
  }
}

export const isPinned = (p: CardPins, k: ScalarPin) => p[k] !== undefined;

/** Form state needed to snapshot the pinned fields. */
export type FormSnapshot = {
  name: string;
  count: string;
  description: string;
  front?: string;
  back?: string;
  rows: (MetaRow & { pin?: boolean })[];
  abilities: Ability[];
  abilityPins: boolean[];
  pinned: Record<ScalarPin, boolean>;
};

/** Build the stored pins from the current form: values of pinned fields only. */
export function snapshot(f: FormSnapshot): CardPins {
  const p: CardPins = {
    props: f.rows.filter((r) => r.pin && r.key.trim()).map(({ key, type, value }) => ({ key: key.trim(), type, value })),
    abilities: f.abilities.filter((_, i) => f.abilityPins[i]).map((a) => ({ ...a })),
  };
  if (f.pinned.name) p.name = f.name;
  if (f.pinned.count) p.count = f.count;
  if (f.pinned.description) p.description = f.description;
  if (f.pinned.front) p.front = f.front ?? null;
  if (f.pinned.back) p.back = f.back ?? null;
  return p;
}

/** Initial New card form state from stored pins plus the deck's property template. */
export function prefill(p: CardPins, template: { key: string; type: MetaType }[]) {
  const rows: (MetaRow & { pin?: boolean })[] = p.props.map((r) => ({ ...r, pin: true }));
  for (const t of template) if (!rows.some((r) => r.key === t.key)) rows.push({ key: t.key, type: t.type, value: t.type === 'boolean' ? 'false' : '' });
  return {
    name: p.name ?? '',
    count: p.count ?? '1',
    description: p.description ?? '',
    front: p.front ?? undefined,
    back: p.back ?? undefined,
    rows,
    abilities: p.abilities.map((a) => ({ ...a })),
    abilityPins: p.abilities.map(() => true),
    pinned: { name: isPinned(p, 'name'), count: isPinned(p, 'count'), description: isPinned(p, 'description'), front: isPinned(p, 'front'), back: isPinned(p, 'back') },
  };
}

/** Card metadata as editable rows. */
export function toRows(md: Record<string, MetaValue>): MetaRow[] {
  return Object.entries(md).map(([key, v]) => ({
    key,
    type: Array.isArray(v) ? 'list' : typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : 'text',
    value: Array.isArray(v) ? v.join(', ') : String(v),
  }));
}

/** Rows back to card metadata; the first invalid number is reported. */
export function fromRows(rows: MetaRow[]): { md: Record<string, MetaValue>; err?: string } {
  const md: Record<string, MetaValue> = {};
  for (const r of rows) {
    const k = r.key.trim();
    if (!k) continue;
    if (r.type === 'number') {
      const n = Number(r.value);
      if (r.value.trim() === '' || !Number.isFinite(n)) return { md, err: `"${k}" must be a number` };
      md[k] = n;
    } else if (r.type === 'boolean') md[k] = r.value === 'true';
    else if (r.type === 'list') md[k] = r.value.split(',').map((s) => s.trim()).filter(Boolean);
    else md[k] = r.value;
  }
  return { md };
}
