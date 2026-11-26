/**
 * card-rotation: a card turned in 45° steps is drawn rotated at its normal size, and the zone it is in makes room for it.
 * A card is a portrait box of width 1 and height `aspect`. Pure.
 */
export const CARD_ASPECT = 1.4;

/** The room a card turned by `rot` steps needs on each side beyond an upright card, as fractions of the card width. */
export function turnedRoom(rot: number, aspect = CARD_ASPECT): { x: number; y: number } {
  const t = (((rot % 8) + 8) % 8) * (Math.PI / 4);
  const c = Math.abs(Math.cos(t));
  const s = Math.abs(Math.sin(t));
  const w = c + aspect * s; // width of the rotated card's box, for a card of width 1
  const h = s + aspect * c;
  return { x: Math.max(0, (w - 1) / 2), y: Math.max(0, (h - aspect) / 2) };
}

/** The room a zone must reserve on each side (fractions of the card width): the largest that any of these rotations needs. */
export function rotationPad(rots: number[], aspect = CARD_ASPECT): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const r of rots) {
    const p = turnedRoom(r, aspect);
    // rounded so that 0° and 180° (a hair of float noise) reserve nothing
    if (p.x > x) x = Math.round(p.x * 1e6) / 1e6;
    if (p.y > y) y = Math.round(p.y * 1e6) / 1e6;
  }
  return { x: x < 1e-5 ? 0 : x, y: y < 1e-5 ? 0 : y };
}

/**
 * The room a zone reserves for the rotated cards in it: a pile shows only its top card, a free zone is a fixed area that
 * reserves nothing, any other zone looks at every card.
 */
export function zonePad(zone: { layout: string; cards: { rot?: number }[] }): { x: number; y: number } {
  if (zone.layout === 'free' || zone.cards.length === 0) return { x: 0, y: 0 };
  const cards = zone.layout === 'pile' ? zone.cards.slice(0, 1) : zone.cards;
  return rotationPad(cards.map((c) => c.rot ?? 0));
}

/**
 * Scale at which a card of `cardW` x `cardH`, rotated by `rot` steps, fits a box of `boxW` x `boxH` (never above 1).
 * Only the loupe's True full view scales a rotated card, because the loupe's box is fixed.
 */
export function fitInBox(rot: number, cardW: number, cardH: number, boxW: number, boxH: number): number {
  const t = ((rot % 8) * Math.PI) / 4;
  const c = Math.abs(Math.cos(t));
  const s = Math.abs(Math.sin(t));
  return Math.min(boxW / (cardW * c + cardH * s), boxH / (cardW * s + cardH * c), 1);
}

/** The CSS transform that draws a card at `rot` (at its normal size unless `fit` is given). Empty for upright. */
export function rotationTransform(rot: number | undefined, fit?: number): string | undefined {
  const r = (rot ?? 0) % 8;
  if (!r) return undefined;
  return fit === undefined ? `rotate(${r * 45}deg)` : `rotate(${r * 45}deg) scale(${fit.toFixed(4)})`;
}
