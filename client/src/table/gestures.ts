/**
 * Zone gesture recognizer (design D11): one state machine per zone.
 *   idle → pressed → { scrub | drag | longPress | tap }
 * - after ~8px of movement the gesture locks to an axis: sideways = scrub, up/out = drag
 * - a still hold (movement < 8px) of 450 ms = long press (card info)
 * - release < 250 ms with no movement = tap
 * - during a scrub, moving up out of the zone switches to a drag of the scrubbed card
 * Pure: fed with pointer samples and time; the host wires DOM events and a timer.
 */
export interface Sample {
  x: number;
  y: number;
  t: number;
}

export interface GestureCallbacks {
  /** Card index under a container-relative point, or null. */
  hit(x: number, y: number): number | null;
  onTap?(index: number | null): void;
  onLongPress?(index: number): void;
  onScrubStart?(index: number): void;
  onScrub?(index: number): void;
  onScrubEnd?(): void;
  onDragStart?(index: number, s: Sample): void;
  onDragMove?(s: Sample): void;
  onDragEnd?(s: Sample): void;
  onCancel?(): void;
}

export interface GestureConfig {
  slop: number;
  longPressMs: number;
  tapMs: number;
  /** Upward distance above the zone's top that converts a scrub into a drag. */
  pullOut: number;
  /** For zones without sideways scrubbing (piles, free layout): any movement is a drag. */
  scrub: boolean;
  /** Scrub axis: 'x' for hands and spreads, 'y' for columns (where sideways movement picks up). */
  axis: 'x' | 'y';
  /** Column width, for the 'y' axis: leaving the column sideways by pullOut turns a scrub into a drag. */
  crossSize?: () => number;
}

export const DEFAULTS: GestureConfig = { slop: 8, longPressMs: 450, tapMs: 250, pullOut: 24, scrub: true, axis: 'x' };

export type GestureState = 'idle' | 'pressed' | 'scrub' | 'drag' | 'longPress';

export class ZoneGesture {
  state: GestureState = 'idle';
  private start: Sample | null = null;
  private startIndex: number | null = null;
  private scrubIndex: number | null = null;
  private cfg: GestureConfig;

  constructor(
    private cb: GestureCallbacks,
    cfg: Partial<GestureConfig> = {},
  ) {
    this.cfg = { ...DEFAULTS, ...cfg };
  }

  down(s: Sample) {
    this.state = 'pressed';
    this.start = s;
    this.startIndex = this.cb.hit(s.x, s.y);
    this.scrubIndex = null;
  }

  /** Call periodically (or from a timer) so a still hold can become a long press. */
  tick(t: number) {
    if (this.state !== 'pressed' || !this.start) return;
    if (t - this.start.t >= this.cfg.longPressMs && this.startIndex !== null) {
      this.state = 'longPress';
      this.cb.onLongPress?.(this.startIndex);
    }
  }

  move(s: Sample) {
    if (!this.start) return;
    const dx = s.x - this.start.x;
    const dy = s.y - this.start.y;
    switch (this.state) {
      case 'pressed': {
        this.tick(s.t);
        if (this.state !== 'pressed') return;
        if (Math.hypot(dx, dy) < this.cfg.slop) return;
        const along = this.cfg.axis === 'y' ? Math.abs(dy) > Math.abs(dx) : Math.abs(dx) >= Math.abs(dy);
        if (this.cfg.scrub && along) {
          const i = this.scrubHit(s) ?? this.startIndex;
          if (i === null) return;
          this.state = 'scrub';
          this.scrubIndex = this.startIndex ?? i;
          this.cb.onScrubStart?.(this.scrubIndex);
          if (i !== this.scrubIndex) {
            this.scrubIndex = i;
            this.cb.onScrub?.(i);
          }
        } else if (this.startIndex !== null) {
          this.state = 'drag';
          this.cb.onDragStart?.(this.startIndex, s);
          this.cb.onDragMove?.(s);
        } else {
          this.state = 'idle';
          this.cb.onCancel?.();
        }
        return;
      }
      case 'scrub': {
        // pulling out of the zone (up for rows, sideways for columns) converts the scrub into a drag
        if (this.pulledOut(s) && this.scrubIndex !== null) {
          this.cb.onScrubEnd?.();
          this.state = 'drag';
          this.cb.onDragStart?.(this.scrubIndex, s);
          this.cb.onDragMove?.(s);
          return;
        }
        const i = this.scrubHit(s);
        if (i !== null && i !== this.scrubIndex) {
          this.scrubIndex = i;
          this.cb.onScrub?.(i);
        }
        return;
      }
      case 'drag':
        this.cb.onDragMove?.(s);
        return;
      default:
        return;
    }
  }

  /** The card under the finger along the scrub axis (the cross position stays where the press began). */
  private scrubHit(s: Sample) {
    return this.cfg.axis === 'y' ? this.cb.hit(this.start!.x, s.y) : this.cb.hit(s.x, this.start!.y);
  }

  private pulledOut(s: Sample) {
    if (this.cfg.axis === 'y') {
      const w = this.cfg.crossSize?.() ?? Infinity;
      return s.x < -this.cfg.pullOut || s.x > w + this.cfg.pullOut;
    }
    return s.y < -this.cfg.pullOut;
  }

  up(s: Sample) {
    const st = this.state;
    const start = this.start;
    this.state = 'idle';
    this.start = null;
    if (!start) return;
    if (st === 'pressed') {
      if (s.t - start.t >= this.cfg.longPressMs && this.startIndex !== null) this.cb.onLongPress?.(this.startIndex);
      else this.cb.onTap?.(this.startIndex);
    } else if (st === 'scrub') this.cb.onScrubEnd?.();
    else if (st === 'drag') this.cb.onDragEnd?.(s);
  }

  cancel() {
    const st = this.state;
    this.state = 'idle';
    this.start = null;
    if (st === 'scrub') this.cb.onScrubEnd?.();
    if (st !== 'idle') this.cb.onCancel?.();
  }
}

/**
 * Paint-selection policy (card-handling spec): with nothing selected a scrub only previews;
 * otherwise the first card touched decides whether the stroke selects or deselects.
 */
export function paintMode(selected: ReadonlySet<string>, firstHandle: string): 'preview' | 'select' | 'deselect' {
  if (selected.size === 0) return 'preview';
  return selected.has(firstHandle) ? 'deselect' : 'select';
}

export function applyPaint(selected: ReadonlySet<string>, mode: 'preview' | 'select' | 'deselect', handle: string): Set<string> {
  const next = new Set(selected);
  if (mode === 'select') next.add(handle);
  else if (mode === 'deselect') next.delete(handle);
  return next;
}
