/**
 * loupe-view-modes: what the card loupe does when the scrubbing finger lifts. Kept per device in this browser;
 * never part of the table and never shared. 'second-finger': release dismisses it and a second finger's tap
 * switches its view. 'stay': release leaves the last card viewed, with buttons on the loupe.
 */
export type LoupeMode = 'second-finger' | 'stay';

const KEY = 'vct.loupeMode';
let memory: LoupeMode | null = null;

/** Second finger on a touch device that can track two touches, otherwise stay open. */
export function defaultLoupeMode(maxTouchPoints = typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints): LoupeMode {
  return maxTouchPoints >= 2 ? 'second-finger' : 'stay';
}

export function getLoupeMode(): LoupeMode {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return memory ?? defaultLoupeMode();
  }
  return raw === 'second-finger' || raw === 'stay' ? raw : (memory ?? defaultLoupeMode());
}

/** The chosen loupe view lasts for the browser tab's session (a reload keeps it); 'auto' means nothing chosen yet. */
export type StoredFace = 'auto' | 'card' | 'details' | 'true';
const FACE_KEY = 'vct.loupeFace';
let faceMemory: StoredFace = 'auto';

export function getLoupeFace(): StoredFace {
  try {
    const v = sessionStorage.getItem(FACE_KEY);
    if (v === 'card' || v === 'details' || v === 'auto' || v === 'true') return v;
  } catch {
    /* in-memory only */
  }
  return faceMemory;
}

export function setLoupeFace(f: StoredFace) {
  faceMemory = f;
  try {
    sessionStorage.setItem(FACE_KEY, f);
  } catch {
    /* in-memory only */
  }
}

export function setLoupeMode(m: LoupeMode) {
  memory = m;
  try {
    localStorage.setItem(KEY, m);
  } catch {
    /* in-memory only */
  }
}
