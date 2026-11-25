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
  /** Two quick taps on the same card (quick-flip). Fired instead of the second onTap. */
  onDoubleTap?(index: number): void;
  /** pile-move: a press that lands within the double-tap window of a tap on the same card. */
  onSecondPress?(index: number): void;
  /** pile-move: that second press starts moving. Replaces the scrub or ordinary drag; the gesture then continues as a drag. */
  onSecondPressDrag?(index: number, s: Sample): void;
  onLongPress?(index: number): void;
  onScrubStart?(index: number): void;
  onScrub?(index: number): void;
  onScrubEnd?(): void;
  /** scrub-loupe: the finger has stayed still for `dwellMs` during a scrub or a drag (once per resting place). */
  onDwell?(index: number | null, s: Sample): void;
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
  /** Max time from the first tap's release to the second tap's release, and max distance between them. */
  doubleTapMs: number;
  doubleTapPx: number;
  /** Scrub axis: 'x' for hands and spreads, 'y' for columns (where sideways movement picks up). */
  axis: 'x' | 'y';
  /** scrub-loupe: how long a still finger waits before onDwell. */
  dwellMs: number;
  /** Column width, for the 'y' axis: leaving the column sideways by pullOut turns a scrub into a drag. */
  crossSize?: () => number;
}

export const DEFAULTS: GestureConfig = { slop: 8, longPressMs: 450, tapMs: 250, pullOut: 24, scrub: true, axis: 'x', doubleTapMs: 300, doubleTapPx: 12, dwellMs: 300 };

export type GestureState = 'idle' | 'pressed' | 'scrub' | 'drag' | 'longPress';

export class ZoneGesture {
  state: GestureState = 'idle';
  private start: Sample | null = null;
  private startIndex: number | null = null;
  private scrubIndex: number | null = null;
  /** The previous tap, for double-tap detection; forgotten by anything that is not a tap. */
  private lastTap: { index: number; x: number; y: number; t: number } | null = null;
  /** The current press follows a tap on the same card within the double-tap window. */
  private secondPress = false;
  private cfg: GestureConfig;
  /** scrub-loupe: where the finger last moved more than the slop, and whether that rest was already reported. */
  private rest: Sample | null = null;
  private restFired = false;
  private last: Sample | null = null;

  constructor(
    private cb: GestureCallbacks,
    cfg: Partial<GestureConfig> = {},
  ) {
    this.cfg = { ...DEFAULTS, ...cfg };
  }

  down(s: Sample) {
    this.state = 'pressed';
    this.start = s;
    this.rest = s;
    this.restFired = false;
    this.last = s;
    this.startIndex = this.cb.hit(s.x, s.y);
    this.scrubIndex = null;
    const prev = this.lastTap;
    this.secondPress =
      this.startIndex !== null &&
      !!prev &&
      prev.index === this.startIndex &&
      s.t - prev.t <= this.cfg.doubleTapMs &&
      Math.hypot(s.x - prev.x, s.y - prev.y) <= this.cfg.doubleTapPx;
    if (this.secondPress) this.cb.onSecondPress?.(this.startIndex!);
  }

  /** Call periodically (or from a timer) so a still hold can become a long press. */
  tick(t: number) {
    if ((this.state === 'scrub' || this.state === 'drag') && this.rest && this.last && !this.restFired && t - this.rest.t >= this.cfg.dwellMs) {
      this.restFired = true;
      this.cb.onDwell?.(this.state === 'scrub' ? this.scrubIndex : null, this.last);
      return;
    }
    if (this.state !== 'pressed' || !this.start) return;
    if (t - this.start.t >= this.cfg.longPressMs && this.startIndex !== null) {
      this.state = 'longPress';
      this.lastTap = null;
      this.cb.onLongPress?.(this.startIndex);
    }
  }

  move(s: Sample) {
    if (!this.start) return;
    this.last = s;
    if (!this.rest || Math.hypot(s.x - this.rest.x, s.y - this.rest.y) > this.cfg.slop) {
      this.rest = s;
      this.restFired = false;
    }
    const dx = s.x - this.start.x;
    const dy = s.y - this.start.y;
    switch (this.state) {
      case 'pressed': {
        this.tick(s.t);
        if (this.state !== 'pressed') return;
        if (Math.hypot(dx, dy) < this.cfg.slop) return;
        if (this.secondPress && this.cb.onSecondPressDrag && this.startIndex !== null) {
          // tap, then press again and move: the caller's "drag everything" gesture (pile-move)
          this.state = 'drag';
          this.lastTap = null;
          this.cb.onSecondPressDrag(this.startIndex, s);
          this.cb.onDragMove?.(s);
          return;
        }
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
      if (s.t - start.t >= this.cfg.longPressMs && this.startIndex !== null) {
        this.lastTap = null;
        this.cb.onLongPress?.(this.startIndex);
      } else this.tap(start, s.t);
    } else {
      this.lastTap = null;
      if (st === 'scrub') this.cb.onScrubEnd?.();
      else if (st === 'drag') this.cb.onDragEnd?.(s);
    }
  }

  private tap(at: Sample, t: number) {
    const i = this.startIndex;
    const prev = this.lastTap;
    if (
      i !== null &&
      prev &&
      prev.index === i &&
      t - prev.t <= this.cfg.doubleTapMs &&
      Math.hypot(at.x - prev.x, at.y - prev.y) <= this.cfg.doubleTapPx &&
      this.cb.onDoubleTap
    ) {
      this.lastTap = null;
      this.cb.onDoubleTap(i);
      return;
    }
    this.lastTap = i === null ? null : { index: i, x: at.x, y: at.y, t };
    this.cb.onTap?.(i);
  }

  cancel() {
    const st = this.state;
    this.lastTap = null;
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
