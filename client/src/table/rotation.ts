/**
 * card-rotation: a card turned in 45° steps is drawn rotated and shrunk so that it stays inside the slot an upright card
 * has (a portrait box of width 1 and height `aspect`). Pure.
 */
export const CARD_ASPECT = 1.4;

/** Scale at which the rotated card's bounding box fits the upright slot: 1 at 0° and 180°, about 0.71 at 90°, about 0.59 at 45°. */
export function rotationFit(rot: number, aspect = CARD_ASPECT): number {
  const t = ((rot % 8) * Math.PI) / 4;
  const c = Math.abs(Math.cos(t));
  const s = Math.abs(Math.sin(t));
  const w = c + aspect * s; // width of the rotated card's box, for a card of width 1
  const h = s + aspect * c;
  return Math.min(1 / w, aspect / h, 1);
}

/**
 * Scale at which a card of `cardW` x `cardH`, rotated by `rot` steps, fits a box of `boxW` x `boxH` (never above 1).
 * The loupe's True full view uses a square box, so a diagonal card is shown larger than in a portrait slot.
 */
export function fitInBox(rot: number, cardW: number, cardH: number, boxW: number, boxH: number): number {
  const t = ((rot % 8) * Math.PI) / 4;
  const c = Math.abs(Math.cos(t));
  const s = Math.abs(Math.sin(t));
  return Math.min(boxW / (cardW * c + cardH * s), boxH / (cardW * s + cardH * c), 1);
}

/** The CSS transform that draws a card at `rot` inside its slot (or scaled by `fit` when given). Empty for upright. */
export function rotationTransform(rot: number | undefined, aspect = CARD_ASPECT, fit?: number): string | undefined {
  const r = (rot ?? 0) % 8;
  if (!r) return undefined;
  return `rotate(${r * 45}deg) scale(${(fit ?? rotationFit(r, aspect)).toFixed(4)})`;
}
