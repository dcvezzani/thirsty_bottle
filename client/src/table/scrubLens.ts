/**
 * pile-scrub-lens: scrubbing a pile by position, over the whole board, with a fisheye lens pinned at one spot. The cards
 * around the pin get wide slots so they are easy to aim at; the rest share what is left, so the whole pile still spans the
 * board and any card can be reached in one slide. A lens that followed the finger would map the finger to the same card as
 * a plain layout, so the lens stays pinned while the finger moves, and is pinned again where the finger rests. Pure.
 */
export const LENS_SLOT = 15; // px per card inside the lens
export const LENS_CARDS = 6; // cards across the lens
export const MIN_SLOT = 2; // no card is ever narrower than this

export interface Pin {
  /** Screen x of the finger when the lens was pinned. */
  x: number;
  /** The card under the finger then. */
  card: number;
}

export interface Lens {
  n: number;
  left: number;
  width: number;
  pin: Pin;
  /** The card whose slot contains screen x (clamped to the pile). */
  indexAt(x: number): number;
  /** Where card i's slot starts and how wide it is. */
  slot(i: number): { x: number; w: number };
}

/** The card a plain (uniform) layout puts at x: where a press first lands. */
export function uniformIndex(n: number, left: number, width: number, x: number): number {
  if (n <= 0) return 0;
  return Math.max(0, Math.min(n - 1, Math.floor(((x - left) / Math.max(1, width)) * n)));
}

export function createLens(n: number, left: number, width: number, pin: Pin, opts: { slot?: number; cards?: number; minSlot?: number } = {}): Lens {
  const Ls = opts.slot ?? LENS_SLOT;
  const K = opts.cards ?? LENS_CARDS;
  const minSlot = opts.minSlot ?? MIN_SLOT;
  const right = left + width;
  const c = Math.max(0, Math.min(n - 1, pin.card));
  const xs: number[] = new Array(n + 1);

  if (n <= 0) {
    xs[0] = left;
  } else if (width < n * minSlot || n <= K) {
    // too many cards for the width (or a small pile): the lens would not fit, so every card gets an equal slot
    for (let i = 0; i <= n; i++) xs[i] = left + (i * width) / n;
  } else {
    // the lens: K cards around the pinned one, as many as keep every other card at least minSlot wide
    let ca = Math.max(0, Math.min(c, c - Math.floor((K - 1) / 2)));
    let cb = Math.min(n, ca + K);
    ca = Math.max(0, Math.min(ca, cb - K));
    if (cb <= c) cb = c + 1;
    const xaOf = () => pin.x - (c - ca + 0.5) * Ls;
    const xbOf = () => pin.x + (cb - c - 0.5) * Ls;
    for (let guard = 0; guard < 4 * K; guard++) {
      const leftOk = ca === 0 || xaOf() - left >= ca * minSlot;
      const rightOk = cb === n || right - xbOf() >= (n - cb) * minSlot;
      if (!leftOk && ca < c) ca += 1;
      else if (!rightOk && cb > c + 1) cb -= 1;
      else break;
    }
    let xa = xaOf();
    let xb = xbOf();
    // the lens stays on the board: at an end it shifts inward, so the first card is at the left end and the last at the right
    if (ca === 0 && xa < left) {
      xb += left - xa;
      xa = left;
    }
    if (cb === n && xb > right) {
      xa -= xb - right;
      xb = right;
    }
    const lensW = xb - xa;
    for (let i = 0; i < ca; i++) xs[i] = left + (i * (xa - left)) / ca;
    for (let i = ca; i <= cb; i++) xs[i] = xa + ((i - ca) * lensW) / (cb - ca);
    for (let i = cb + 1; i <= n; i++) xs[i] = xb + ((i - cb) * (right - xb)) / (n - cb);
    if (ca === 0) xs[0] = Math.min(xs[0], left);
  }

  const indexAt = (x: number) => {
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (xs[mid] <= x) lo = mid;
      else hi = mid - 1;
    }
    return Math.max(0, Math.min(Math.max(0, n - 1), lo));
  };
  const slot = (i: number) => ({ x: xs[i], w: (xs[i + 1] ?? right) - xs[i] });
  return { n, left, width, pin, indexAt, slot };
}
