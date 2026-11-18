/**
 * Scrolling while dragging (card-handling): holding dragged cards in the top or bottom band of the
 * board for a short pause scrolls it toward that edge, faster closer to the edge. Pure.
 */
export const BAND_PX = 56;
export const DWELL_MS = 250;
const MIN_SPEED = 200; // px/s at the inner edge of the band
const EXTRA_SPEED = 1000; // added at the outer edge

/** Signed scroll speed (px/s, negative = up) for a point at clientY; 0 outside the bands. */
export function bandSpeed(y: number, top: number, bottom: number, band = BAND_PX): number {
  const h = bottom - top;
  const b = Math.min(band, h / 3); // short boards: bands never meet
  if (y < top || y > bottom) return 0;
  if (y < top + b) return -(MIN_SPEED + EXTRA_SPEED * ((top + b - y) / b));
  if (y > bottom - b) return MIN_SPEED + EXTRA_SPEED * ((y - (bottom - b)) / b);
  return 0;
}

/** Tracks the dwell: speed is 0 until the point has stayed in the same band for DWELL_MS. */
export class EdgeScroller {
  private since: number | null = null;
  private dir = 0;

  speed(y: number, t: number, top: number, bottom: number): number {
    const s = bandSpeed(y, top, bottom);
    const dir = Math.sign(s);
    if (dir === 0) {
      this.reset();
      return 0;
    }
    if (dir !== this.dir || this.since === null) {
      this.dir = dir;
      this.since = t;
    }
    return t - this.since >= DWELL_MS ? s : 0;
  }

  reset() {
    this.since = null;
    this.dir = 0;
  }
}
