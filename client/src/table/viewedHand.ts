import type { CardView } from '@vct/shared';

/**
 * viewed-hand-priority: how another player's hand is shown while viewing their table.
 * Cards shown or peeked to the viewer (`known`) come first, in hand order, and are drawn at hand size;
 * the rest are one small stack with a count. Display only: the real hand order is untouched.
 */
export function viewedHandDisplay(cards: CardView[]) {
  const shown = cards.filter((c) => c.known);
  return { shown, hidden: cards.length - shown.length, total: cards.length };
}

/** The line above or inside the viewed hand: "Dave's hand is empty", "... none shown to you", "... 2 shown to you". */
export function viewedHandText(name: string, d: { shown: unknown[]; total: number }): string {
  if (d.total === 0) return `${name}'s hand is empty`;
  if (d.shown.length === 0) return `${name}'s hand · ${d.total} · none shown to you`;
  return `${name}'s hand · ${d.total} · ${d.shown.length} shown to you`;
}
