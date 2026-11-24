import type { CardView } from '@vct/shared';

/** shared-hand-dock: which column of the hand dock is the wide one while viewing another table. */
export type HandColumn = 'viewed' | 'mine';

export const FOCUS_SETTLE_MS = 150;

/** What happened in or over a column. A tap never changes the focus; a scrub or a carried card focuses that column. */
export type FocusEvent = { kind: 'tap' | 'scrub' | 'carry'; column: HandColumn };

export function nextFocus(current: HandColumn, ev: FocusEvent): HandColumn {
  return ev.kind === 'tap' ? current : ev.column;
}

/**
 * Cards shown or peeked to the viewer (`known`) first, in hand order; the rest are only counted.
 * Display only: the real hand order is untouched.
 */
export function viewedHandDisplay(cards: CardView[]) {
  const shown = cards.filter((c) => c.known);
  return { shown, hidden: cards.length - shown.length, total: cards.length };
}

/** The badge over a column: "Sam · 5 · 2 shown", "Sam · 5 · none shown", "Sam · empty". */
export function handBadgeText(name: string, d: { shown: unknown[]; total: number }): string {
  if (d.total === 0) return `${name} · empty`;
  if (d.shown.length === 0) return `${name} · ${d.total} · none shown`;
  return `${name} · ${d.total} · ${d.shown.length} shown`;
}

/** True when the number of cards shown to the viewer went up (the viewed column pulses if it is narrow). */
export const shownIncreased = (before: number, after: number) => after > before;
