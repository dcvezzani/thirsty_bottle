/**
 * Fan / spread layout math (design D11). Hit-testing is computed from layout math, not DOM,
 * so it is O(1) per pointer event and unaffected by overlapping card elements.
 */
export interface FanLayout {
  n: number;
  cardW: number;
  cardH: number;
  /** Horizontal distance between consecutive card left edges. */
  spacing: number;
  /** x of the first card's left edge within the container. */
  left: number;
  width: number;
  arc: boolean;
}

export function fanLayout(n: number, width: number, cardW: number, opts: { arc?: boolean; maxSpacing?: number; gapAt?: number | null } = {}): FanLayout {
  const cardH = cardW * 1.4;
  const max = opts.maxSpacing ?? cardW * 0.62;
  // rotated end cards of an arc swing outwards: keep them on screen
  const pad = opts.arc ? cardW * 0.3 : 4;
  const usable = Math.max(0, width - cardW - 2 * pad);
  const spacing = n > 1 ? Math.min(max, usable / (n - 1 + (opts.gapAt != null ? 1 : 0))) : 0;
  const total = n > 0 ? cardW + spacing * (n - 1 + (opts.gapAt != null ? 1 : 0)) : 0;
  const left = Math.max(pad, (width - total) / 2);
  return { n, cardW, cardH, spacing, left, width, arc: !!opts.arc };
}

/** Position of card i (with an optional insertion gap). */
export function cardPos(l: FanLayout, i: number, gapAt: number | null = null): { x: number; y: number; rot: number } {
  const slot = gapAt != null && i >= gapAt ? i + 1 : i;
  const x = l.left + slot * l.spacing;
  if (!l.arc || l.n < 2) return { x, y: 0, rot: 0 };
  const t = l.n > 1 ? slot / (l.n - 1 + (gapAt != null ? 1 : 0)) - 0.5 : 0; // -0.5..0.5
  const maxRot = Math.min(14, 2 + l.n * 0.8);
  return { x, y: Math.abs(t) * t * 0 + t * t * l.cardW * 0.5, rot: t * 2 * maxRot };
}

/** Card index under container-relative x (the topmost card covering x), or null if outside. */
export function hitIndex(l: FanLayout, x: number): number | null {
  if (l.n === 0) return null;
  const rel = x - l.left;
  if (rel < 0 || rel > l.spacing * (l.n - 1) + l.cardW) return null;
  if (l.spacing <= 0) return l.n - 1;
  // cards overlap left-to-right: later cards are on top, so the visible strip of card i is [i*s, (i+1)*s)
  return Math.max(0, Math.min(l.n - 1, Math.floor(rel / l.spacing)));
}

/** Index at which dropped cards would be inserted for container-relative x. */
export function insertionIndex(l: FanLayout, x: number): number {
  if (l.n === 0 || l.spacing <= 0) return x < l.left + l.cardW / 2 ? 0 : l.n;
  const rel = x - l.left - l.cardW / 2 + l.spacing / 2;
  return Math.max(0, Math.min(l.n, Math.floor(rel / l.spacing) + 1));
}

/** Magnification offsets for card i while card `focus` is being scrubbed. */
export function magnify(l: FanLayout, i: number, focus: number | null): { dx: number; dy: number; scale: number; z: number } {
  if (focus === null) return { dx: 0, dy: 0, scale: 1, z: 0 };
  const d = i - focus;
  if (d === 0) return { dx: 0, dy: -l.cardH * 0.35, scale: 1.6, z: 100 };
  const push = Math.max(l.cardW * 0.25, l.cardW * 0.8 - l.spacing) * Math.exp(-(Math.abs(d) - 1) * 0.7);
  return { dx: Math.sign(d) * push, dy: 0, scale: 1, z: 0 };
}

/**
 * Hit-test that accounts for fan rotation (cards rotate around their bottom centre).
 * Checks cards from the topmost down; falls back to the strip test when no card contains the point.
 * `top` is the y offset of unrotated cards inside the container.
 */
export function hitIndexXY(l: FanLayout, x: number, y: number, top = 0, gapAt: number | null = null): number | null {
  if (l.n === 0) return null;
  if (!l.arc) return hitIndex(l, x);
  for (let i = l.n - 1; i >= 0; i--) {
    const p = cardPos(l, i, gapAt);
    const px = p.x + l.cardW / 2;
    const py = top + p.y + l.cardH;
    const a = (-p.rot * Math.PI) / 180;
    const dx = x - px;
    const dy = y - py;
    const rx = dx * Math.cos(a) - dy * Math.sin(a) + px;
    const ry = dx * Math.sin(a) + dy * Math.cos(a) + py;
    if (rx >= p.x && rx <= p.x + l.cardW && ry >= top + p.y && ry <= top + p.y + l.cardH) return i;
  }
  return hitIndex(l, x);
}
