/**
 * Column zones (zone-arrangement): cards cascade downward, face-down cards as slivers, face-up cards
 * showing their rank corner, compressed to stay within about 2.5 card heights without hiding ranks.
 * Pure.
 */
export const DOWN_STEP = 0.07;
export const UP_STEP = 0.22;
export const DOWN_MIN = 0.035;
export const UP_MIN = 0.125; // plus 4px: the rank line of the corner
export const CAP = 2.5;

export interface ColumnLayout {
  /** y offset of each card's top edge. */
  y: number[];
  /** Step from card i to card i+1 (last entry 0). */
  step: number[];
  height: number;
  cardH: number;
}

export function columnLayout(faceUp: boolean[], cardH: number, cap = CAP * cardH): ColumnLayout {
  const n = faceUp.length;
  if (!n) return { y: [], step: [], height: cardH, cardH };
  const base = faceUp.map((up, i) => (i === n - 1 ? 0 : (up ? UP_STEP : DOWN_STEP) * cardH));
  const floor = faceUp.map((up, i) => (i === n - 1 ? 0 : up ? 4 + UP_MIN * cardH : DOWN_MIN * cardH));
  const sum = base.reduce((a, b) => a + b, 0);
  let step = base;
  if (sum + cardH > cap && sum > 0) {
    // scale down toward the cap; floored steps can't shrink, so give the others what is left
    const room = Math.max(0, cap - cardH);
    let f = room / sum;
    for (let k = 0; k < 4; k++) {
      const floored = base.map((b, i) => b * f < floor[i]);
      const fixed = floor.reduce((t, fl, i) => t + (floored[i] ? fl : 0), 0);
      const free = base.reduce((t, b, i) => t + (floored[i] ? 0 : b), 0);
      if (!free) break;
      f = Math.max(0, room - fixed) / free;
    }
    step = base.map((b, i) => Math.max(floor[i], b * f));
  }
  return fromSteps(step, cardH);
}

function fromSteps(step: number[], cardH: number): ColumnLayout {
  const y: number[] = [];
  let t = 0;
  for (const s of step) {
    y.push(t);
    t += s;
  }
  return { y, step, height: (y.at(-1) ?? 0) + cardH, cardH };
}

/**
 * The column with the cards below `focus` opened up for reading (scrub / hover). Only the steps from the focused card downwards
 * open, so the focused card and every card above it stay exactly where they are in the compressed column: nothing moves under
 * the finger, and the card found at a position is the card drawn there (column-scrub-hit).
 */
export function columnMagnify(l: ColumnLayout, focus: number | null): ColumnLayout {
  if (focus === null || !l.y.length) return l;
  const open = [0.75, 0.35, 0.2]; // by distance below the focused card
  const step = l.step.map((s, i) => {
    if (i === l.step.length - 1) return 0;
    if (i < focus) return s;
    const d = i - focus;
    return d < open.length ? Math.max(s, open[d] * l.cardH) : s;
  });
  return fromSteps(step, l.cardH);
}

/** Index of the card visible at y (later cards cover earlier ones), or null. */
export function columnHit(l: ColumnLayout, y: number): number | null {
  for (let i = l.y.length - 1; i >= 0; i--) if (y >= l.y[i] && y <= l.y[i] + l.cardH) return i;
  return null;
}
