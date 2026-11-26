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
 * pile-shows-turned: a card's outline is its rotation modulo 180° (a card turned 180° covers exactly the same area), so
 * there are four outlines: 0°/180°, 45°/225°, 90°/270° and 135°/315°.
 */
export const outline = (rot: number) => (((rot % 4) + 4) % 4);

/**
 * Which cards of a pile are drawn, as indices from the top: the top card, then the first card beneath it of each outline
 * that no card already drawn has (a card with an outline already drawn would be covered). At most four indices.
 */
export function pileShown(rots: number[]): number[] {
  if (rots.length === 0) return [];
  const seen = new Set<number>([outline(rots[0])]);
  const out = [0];
  for (let i = 1; i < rots.length && seen.size < 4; i++) {
    const o = outline(rots[i]);
    if (seen.has(o)) continue;
    seen.add(o);
    out.push(i);
  }
  return out;
}

/** The outline of a card turned by `rot` steps as a box, for a card of width 1: its width and height. */
function boxOf(rot: number, aspect = CARD_ASPECT): { w: number; h: number } {
  const t = (((rot % 8) + 8) % 8) * (Math.PI / 4);
  const c = Math.abs(Math.cos(t));
  const s = Math.abs(Math.sin(t));
  return { w: c + aspect * s, h: s + aspect * c };
}

/**
 * pile-corner-stack: how a pile arranges the cards it draws (`rots`, the top card first). When they have more than one
 * outline they are lined up by the bottom-left corner of their rotated boxes, so a larger outline sticks out along the top and
 * the right (an L), and the pile reserves room only there. `place(r)` is the offset of a card turned by `r` steps from where an
 * upright card sits (fractions of the card width, CSS y down), which puts its box's bottom-left corner at the slot's.
 * With one outline the pile is centred as before (`corner` false).
 */
export function pileCorner(rots: number[], aspect = CARD_ASPECT): { corner: boolean; right: number; top: number; place: (rot: number) => { dx: number; dy: number } } {
  const outlines = new Set(rots.map(outline));
  const place = (rot: number) => {
    const b = boxOf(rot, aspect);
    const dx = b.w / 2 - 0.5;
    const dy = aspect / 2 - b.h / 2;
    return { dx: Math.abs(dx) < 1e-9 ? 0 : dx, dy: Math.abs(dy) < 1e-9 ? 0 : dy };
  };
  if (outlines.size < 2) return { corner: false, right: 0, top: 0, place };
  let w = 1;
  let h = aspect;
  for (const r of rots) {
    const b = boxOf(r, aspect);
    w = Math.max(w, b.w);
    h = Math.max(h, b.h);
  }
  return { corner: true, right: Math.max(0, w - 1), top: Math.max(0, h - aspect), place };
}

/**
 * The room a zone reserves for the rotated cards in it: a pile counts the cards it draws (its top card and the differently
 * turned cards beneath), a free zone is a fixed area that reserves nothing, any other zone looks at every card.
 */
export function zonePad(zone: { layout: string; cards: { rot?: number }[] }): { x: number; y: number } {
  if (zone.layout === 'free' || zone.cards.length === 0) return { x: 0, y: 0 };
  const rots = zone.cards.map((c) => c.rot ?? 0);
  if (zone.layout === 'pile') {
    const drawn = pileShown(rots).map((i) => rots[i]);
    const c = pileCorner(drawn);
    // a mixed pile reserves room only to the right and above; the flow doubles x, so half of the one-sided room stands for it
    return c.corner ? { x: c.right / 2, y: c.top / 2 } : rotationPad(drawn);
  }
  return rotationPad(rots);
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
export function rotationTransform(rot: number | undefined, fit?: number, shift?: { dx: number; dy: number }): string | undefined {
  const r = (rot ?? 0) % 8;
  if (!r) return undefined;
  // pile-corner-stack: a shift (fractions of the card width) moves the card before it turns about its own centre
  const move = shift && (shift.dx || shift.dy) ? `translate(calc(var(--card-w) * ${shift.dx.toFixed(4)}), calc(var(--card-w) * ${shift.dy.toFixed(4)})) ` : '';
  return fit === undefined ? `${move}rotate(${r * 45}deg)` : `${move}rotate(${r * 45}deg) scale(${fit.toFixed(4)})`;
}
