/**
 * header-scrub: what a press on a zone header turns into.
 *   pressed -> tap (released without moving, before the hold)
 *           -> hold (the host's still hold: arrange mode)
 *           -> slide (moved more than the slop; the header strip takes over)
 *   slide   -> exit (the finger went down out of the header, into the zone's cards)
 * Pure: fed with pointer samples and time; the host wires DOM events, a clock and the hold's meaning.
 */
export interface HSample {
  x: number;
  y: number;
  t: number;
}

export interface HeaderCallbacks {
  onTap?(): void;
  /** A still hold of `holdMs`; only when `hold` is enabled (the host's arrange mode). */
  onHold?(): void;
  onSlideStart?(s: HSample): void;
  onSlide?(s: HSample): void;
  /** The finger left the header downwards (past `isBelow`): the zone's own gesture takes over. */
  onExit?(s: HSample): void;
  /** Held still for `dwellMs` during the slide (once per resting place). */
  onDwell?(s: HSample): void;
  onEnd?(): void;
}

export interface HeaderConfig {
  slop: number;
  holdMs: number;
  dwellMs: number;
  /** Whether a still hold means something (the host only). */
  hold: boolean;
  /** True when a point is below the header, inside the zone's cards, and the zone can take a scrub from there. */
  isBelow(s: HSample): boolean;
}

export const HEADER_DEFAULTS = { slop: 8, holdMs: 500, dwellMs: 300 };

export type HeaderState = 'idle' | 'pressed' | 'held' | 'slide' | 'exited' | 'vertical';

export class HeaderGesture {
  state: HeaderState = 'idle';
  private start: HSample | null = null;
  private rest: HSample | null = null;
  private restFired = false;
  private last: HSample | null = null;

  constructor(
    private cb: HeaderCallbacks,
    private cfg: HeaderConfig,
  ) {}

  down(s: HSample) {
    this.state = 'pressed';
    this.start = s;
    this.rest = s;
    this.last = s;
    this.restFired = false;
  }

  /** Call periodically so a still hold (host) and a pause during a slide are noticed. */
  tick(t: number) {
    if (this.state === 'pressed' && this.start && this.cfg.hold && t - this.start.t >= this.cfg.holdMs) {
      this.state = 'held';
      this.cb.onHold?.();
      return;
    }
    if (this.state === 'slide' && this.rest && this.last && !this.restFired && t - this.rest.t >= this.cfg.dwellMs) {
      this.restFired = true;
      this.cb.onDwell?.(this.last);
    }
  }

  move(s: HSample) {
    if (!this.start) return;
    this.last = s;
    if (this.state === 'pressed') {
      if (Math.hypot(s.x - this.start.x, s.y - this.start.y) < this.cfg.slop) return;
      // a mostly vertical first move is the board's one-finger scroll, not a header scrub: leave it to the browser
      if (Math.abs(s.y - this.start.y) > Math.abs(s.x - this.start.x)) {
        this.state = 'vertical';
        return;
      }
      this.state = 'slide';
      this.rest = s;
      this.restFired = false;
      this.cb.onSlideStart?.(s);
    }
    if (this.state !== 'slide') return;
    if (this.rest && Math.hypot(s.x - this.rest.x, s.y - this.rest.y) > this.cfg.slop) {
      this.rest = s;
      this.restFired = false;
    }
    if (this.cfg.isBelow(s)) {
      this.state = 'exited';
      this.cb.onExit?.(s);
      return;
    }
    this.cb.onSlide?.(s);
  }

  up(_s: HSample) {
    const st = this.state;
    this.state = 'idle';
    this.start = null;
    if (st === 'pressed') this.cb.onTap?.();
    else if (st === 'slide') this.cb.onEnd?.();
  }

  cancel() {
    const st = this.state;
    this.state = 'idle';
    this.start = null;
    if (st === 'slide') this.cb.onEnd?.();
  }
}
