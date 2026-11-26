/** loupe-view-modes: the loupe's two views and when a stay-open view ends. Pure. */
/**
 * The loupe's view. 'auto' until the player first chooses: the large card, with a pause peeking at the details.
 * Once 'card', 'details' or 'true' (the true full view: the card at full size with its rotation) is chosen it stays
 * chosen for the browser session and a pause no longer changes it. Card and Details always show the card upright.
 */
export type LoupeFace = 'auto' | 'card' | 'details' | 'true';

/** Details show when chosen, or (only before any choice) while a pause is peeking at them. */
export const showsDetails = (face: LoupeFace, peek: boolean) => face === 'details' || (face === 'auto' && peek);

/** The true full view shows the card with its rotation, at full size. */
export const showsTrue = (face: LoupeFace) => face === 'true';

/**
 * A tap on the loupe steps what is on screen to the next view and makes that the chosen view: Card, Details, True full,
 * and back to Card. A pause's peek counts as Details.
 */
export function toggleView(face: LoupeFace, peek: boolean): { face: LoupeFace; peek: boolean } {
  if (showsTrue(face)) return { face: 'card', peek: false };
  if (showsDetails(face, peek)) return { face: 'true', peek: false };
  return { face: 'details', peek: false };
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

/**
 * What a second finger did on the loupe: a quick tap switches the view; a quick sideways swipe rotates the card
 * (right = clockwise, left = counter-clockwise); anything else (a hold, a slow drag) does nothing.
 */
export const SWIPE_MS = 500;
export const SWIPE_PX = 24;
export function secondFingerGesture(down: { t: number; x: number; y: number }, up: { t: number; x: number; y: number }): 'tap' | 'right' | 'left' | null {
  if (isQuickTap(down, up)) return 'tap';
  const dx = up.x - down.x;
  const dy = up.y - down.y;
  if (up.t - down.t <= SWIPE_MS && Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > 2 * Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return null;
}

/** A tap of a second finger: quick and nearly still. */
export const TAP_MS = 250;
export const TAP_PX = 10;
export function isQuickTap(down: { t: number; x: number; y: number }, up: { t: number; x: number; y: number }): boolean {
  return up.t - down.t <= TAP_MS && Math.hypot(up.x - down.x, up.y - down.y) <= TAP_PX;
}
