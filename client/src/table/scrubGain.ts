/**
 * pile-scrub: scrubbing a long pile by finger travel instead of finger position. A pile of 52 cards fanned across a phone is
 * a few pixels per card, below what a fingertip can aim at, so the card follows how far the finger has travelled, with a gain
 * that depends on speed: slow movement steps card by card, a fast sweep covers the whole pile. Pure.
 */
export const SLOW_PX_PER_CARD = 12; // slow movement: one card per this many pixels
export const V_SLOW = 0.12; // px/ms at or below which the gain is the slow one
export const V_FAST = 1.0; // px/ms at or above which a sweep across `span` covers the pile

/** Cards per pixel at a finger speed (px/ms): slow stepping up to a sweep of `span` px covering all `n` cards. */
export function scrubGain(speed: number, n: number, span: number): number {
  const slow = 1 / SLOW_PX_PER_CARD;
  const fast = Math.max(slow, n / Math.max(1, span));
  const t = Math.min(1, Math.max(0, (speed - V_SLOW) / (V_FAST - V_SLOW)));
  const s = t * t * (3 - 2 * t); // smoothstep: no sudden jump of gain
  return slow + (fast - slow) * s;
}

export class RelativeScrub {
  private pos: number;
  private x: number;
  private t: number;
  private speed = 0;

  /** The scrub starts on card `start` with the finger at x (px) at time t (ms). */
  constructor(
    private n: number,
    start: number,
    from: { x: number; t: number },
    private span: number,
  ) {
    this.pos = start;
    this.x = from.x;
    this.t = from.t;
  }

  /** Feed a finger sample; returns the card index it now points at. */
  update(s: { x: number; t: number }): number {
    const dx = s.x - this.x;
    const dt = Math.max(1, s.t - this.t);
    this.speed = 0.6 * this.speed + 0.4 * (Math.abs(dx) / dt);
    this.pos = Math.min(this.n - 1, Math.max(0, this.pos + dx * scrubGain(this.speed, this.n, this.span)));
    this.x = s.x;
    this.t = s.t;
    return Math.round(this.pos);
  }
}
