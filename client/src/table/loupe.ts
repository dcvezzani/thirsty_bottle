/**
 * loupe-viewport-size: where the loupe goes and how big its card is. It docks at the top or the bottom edge of the
 * whole view (the header and footer may be covered), full width up to a cap, as tall as the room beyond the pressed
 * zone allows. Chosen when a press starts, kept until the finger lifts. Pure: the host measures the zone and the view.
 */
export interface Box {
  top: number;
  bottom: number;
}

/** The loupe is never taller than this share of the view, nor shorter than the floor (it may then overlap the zone). */
export const LOUPE_MAX_SHARE = 0.6;
export const LOUPE_MIN_SHARE = 0.35;
export const LOUPE_MAX_W = 720;
const MARGIN = 8;
const PAD = 20; // horizontal padding inside the loupe
const CAP_H = 44; // caption line and gaps
const CONTROLS_H = 44; // the buttons row after release in "stay open" mode

export interface LoupePlace {
  side: 'top' | 'bottom';
  /** Top of the box in viewport pixels, and its height. */
  y: number;
  h: number;
}

/** `view` is the usable viewport: top/bottom already inset by any safe area. */
export function pickLoupe(zone: Box, view: Box): LoupePlace {
  const vh = view.bottom - view.top;
  const maxH = Math.floor(vh * LOUPE_MAX_SHARE);
  const minH = Math.floor(vh * LOUPE_MIN_SHARE);
  const above = zone.top - view.top - MARGIN * 2;
  const below = view.bottom - zone.bottom - MARGIN * 2;
  const side = above >= below ? 'top' : 'bottom';
  const h = Math.max(minH, Math.min(maxH, side === 'top' ? above : below));
  return side === 'top' ? { side, y: view.top + MARGIN, h } : { side, y: view.bottom - MARGIN - h, h };
}

export interface LoupeSizes {
  /** Card width in the Card view, the card beside the text in Details, and the card in the square True full box. */
  card: number;
  details: number;
  trueCard: number;
}

/** Card sizes that fill a loupe of height `h` and width `width` (the stay-open loupe also holds a buttons row). */
export function loupeSizes(h: number, width: number, stay: boolean): LoupeSizes {
  const room = Math.max(60, h - 16 - CAP_H - (stay ? CONTROLS_H : 0));
  const across = Math.max(60, width - PAD);
  const byH = Math.floor(room / 1.4);
  return {
    card: Math.min(byH, across),
    details: Math.min(byH, Math.floor(across * 0.42)),
    trueCard: Math.floor(Math.min(room, across) / 1.4),
  };
}

export function loupeWidth(viewW: number) {
  return Math.min(viewW - 16, LOUPE_MAX_W);
}

/** The safe-area insets (notch, home indicator) in pixels; zero where unsupported. */
export function safeInsets(): { top: number; bottom: number } {
  if (typeof document === 'undefined') return { top: 0, bottom: 0 };
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const out = { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
  probe.remove();
  return out;
}

/** The usable viewport box. */
export function viewBox(): Box {
  const i = safeInsets();
  return { top: i.top, bottom: window.innerHeight - i.bottom };
}
