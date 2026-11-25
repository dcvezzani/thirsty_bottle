/** loupe-view-modes: the loupe's two views and when a stay-open view ends. Pure. */
export type LoupeFace = 'card' | 'details';

/** Details show when chosen, or while a pause is peeking at them. */
export const showsDetails = (face: LoupeFace, peek: boolean) => face === 'details' || peek;

export const flipFace = (f: LoupeFace): LoupeFace => (f === 'card' ? 'details' : 'card');

/**
 * A tap on the loupe switches what is on screen: if details show (chosen, or peeked at during a pause) it goes back to the
 * large card and the peek is dropped; otherwise it shows details. A pause only peeks again after the finger has moved on.
 */
export function toggleView(face: LoupeFace, peek: boolean): { face: LoupeFace; peek: boolean } {
  return showsDetails(face, peek) ? { face: 'card', peek: false } : { face: 'details', peek: false };
}

export type ViewingEvent =
  | 'close' // the close button
  | 'escape'
  | 'scrubStart'
  | 'dragStart'
  | 'select' // a tap that selects a card
  | 'tapViewed' // a tap on the viewed card itself
  | 'felt' // a tap on empty table
  | 'sheet' // a sheet or drawer opened
  | 'pan' // two-finger pan
  | 'scroll';

/** A stay-open view ends on these; panning or scrolling the board does not end it. */
export function endsViewing(e: ViewingEvent): boolean {
  return e !== 'pan' && e !== 'scroll';
}

/** A tap of a second finger: quick and nearly still. */
export const TAP_MS = 250;
export const TAP_PX = 10;
export function isQuickTap(down: { t: number; x: number; y: number }, up: { t: number; x: number; y: number }): boolean {
  return up.t - down.t <= TAP_MS && Math.hypot(up.x - down.x, up.y - down.y) <= TAP_PX;
}
