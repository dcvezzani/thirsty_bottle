/**
 * Two-finger board panning (card-handling: two-finger scrolling anywhere on the board).
 * Pure: fed with pointer samples and time; `useBoardPan` wires DOM events and scrolling.
 */
export interface Velocity {
  vx: number; // px per ms
  vy: number;
}

const VELOCITY_WINDOW_MS = 100;
export const GLIDE_DECAY = 0.95; // per 16 ms frame
export const GLIDE_STOP = 0.02; // px per ms

export class TwoFingerPan {
  private pts = new Map<number, { x: number; y: number }>();
  private samples: { t: number; x: number; y: number }[] = [];
  private mid: { x: number; y: number } | null = null;
  /** True while exactly two tracked pointers are down. */
  active = false;

  /** Returns true when this pointer makes it a two-finger pan (card gestures must cancel). */
  down(id: number, x: number, y: number, t: number): boolean {
    this.pts.set(id, { x, y });
    if (this.pts.size === 2 && !this.active) {
      this.active = true;
      this.mid = this.midpoint();
      this.samples = [{ t, ...this.mid }];
      return true;
    }
    return false;
  }

  /** Scroll delta for this move: how far the fingers' midpoint moved (zero unless panning). */
  move(id: number, x: number, y: number, t: number): { dx: number; dy: number } {
    if (!this.pts.has(id)) return { dx: 0, dy: 0 };
    this.pts.set(id, { x, y });
    if (!this.active || this.pts.size !== 2 || !this.mid) return { dx: 0, dy: 0 };
    const m = this.midpoint();
    const d = { dx: m.x - this.mid.x, dy: m.y - this.mid.y };
    this.mid = m;
    this.samples.push({ t, ...m });
    while (this.samples.length > 2 && t - this.samples[0].t > VELOCITY_WINDOW_MS) this.samples.shift();
    return d;
  }

  /** A finger lifted or was cancelled. Returns the glide velocity when this ends a pan. */
  up(id: number, t: number): Velocity | null {
    if (!this.pts.delete(id)) return null;
    if (!this.active) return null;
    this.active = false;
    this.mid = null;
    const v = velocity(this.samples, t);
    this.samples = [];
    return v;
  }

  /** Pointers still down after a pan ended must not start another one until all lift. */
  get count() {
    return this.pts.size;
  }

  private midpoint() {
    const [a, b] = [...this.pts.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
}

/** Average midpoint velocity over the last 100 ms; zero if the fingers paused before lifting. */
export function velocity(samples: { t: number; x: number; y: number }[], now: number): Velocity {
  const recent = samples.filter((s) => now - s.t <= VELOCITY_WINDOW_MS);
  if (recent.length < 2) return { vx: 0, vy: 0 };
  const a = recent[0];
  const b = recent[recent.length - 1];
  const dt = Math.max(1, b.t - a.t);
  return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt };
}

/** The glide after release: scroll deltas per 16 ms frame, decaying until slower than GLIDE_STOP. */
export function glideSteps(v: Velocity, frameMs = 16): { dx: number; dy: number }[] {
  const out: { dx: number; dy: number }[] = [];
  let { vx, vy } = v;
  while (Math.hypot(vx, vy) >= GLIDE_STOP && out.length < 400) {
    out.push({ dx: vx * frameMs, dy: vy * frameMs });
    vx *= GLIDE_DECAY;
    vy *= GLIDE_DECAY;
  }
  return out;
}

// --- cancel signal for card gestures (a second finger means "scroll", not "handle cards") ---
const cancelers = new Set<() => void>();
export function onCancelCardGestures(fn: () => void): () => void {
  cancelers.add(fn);
  return () => {
    cancelers.delete(fn);
  };
}
export function cancelCardGestures() {
  for (const fn of cancelers) fn();
}

// While two fingers pan the board, zones ignore new presses (the second finger also lands on a zone).
let panning = false;
export function setBoardPanning(on: boolean) {
  panning = on;
}
export function isBoardPanning() {
  return panning;
}
