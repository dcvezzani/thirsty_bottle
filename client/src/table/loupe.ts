/**
 * scrub-loupe: where the loupe goes. It is a fixed box at the top or the bottom of the board, chosen
 * when a press starts so that it does not cover the pressed zone, and kept until the finger lifts.
 * Pure: the host measures the zone and the board.
 */
export interface Box {
  top: number;
  bottom: number;
}

export const LOUPE_MAX_H = 300;
export const LOUPE_MIN_H = 170;
const MARGIN = 8;

export interface LoupePlace {
  side: 'top' | 'bottom';
  /** Top of the box in viewport pixels, and its height. */
  y: number;
  h: number;
}

export function pickLoupe(zone: Box, board: Box, maxH = LOUPE_MAX_H, minH = LOUPE_MIN_H): LoupePlace {
  const above = zone.top - board.top - MARGIN * 2;
  const below = board.bottom - zone.bottom - MARGIN * 2;
  const top = (h: number): LoupePlace => ({ side: 'top', y: board.top + MARGIN, h });
  const bottom = (h: number): LoupePlace => ({ side: 'bottom', y: board.bottom - MARGIN - h, h });
  if (above >= maxH) return top(maxH);
  if (below >= maxH) return bottom(maxH);
  // neither side is roomy enough: take the larger one and shrink the loupe to fit (never below minH)
  return above >= below ? top(Math.max(minH, Math.min(maxH, above))) : bottom(Math.max(minH, Math.min(maxH, below)));
}
