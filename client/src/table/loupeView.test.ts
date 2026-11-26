import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultLoupeMode, getLoupeFace, getLoupeMode, setLoupeFace, setLoupeMode } from '../lib/loupePrefs';
import { endsViewing, isQuickTap, secondFingerGesture, showsDetails, showsTrue, toggleView, type ViewingEvent } from './loupeView';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('loupe mode preference (1.1)', () => {
  it('defaults by how many touches the device can track', () => {
    expect(defaultLoupeMode(5)).toBe('second-finger');
    expect(defaultLoupeMode(2)).toBe('second-finger');
    expect(defaultLoupeMode(1)).toBe('stay');
    expect(defaultLoupeMode(0)).toBe('stay');
  });
  it('keeps the choice in the browser', () => {
    setLoupeMode('stay');
    expect(localStorage.getItem('vct.loupeMode')).toBe('stay');
    expect(getLoupeMode()).toBe('stay');
    setLoupeMode('second-finger');
    expect(getLoupeMode()).toBe('second-finger');
  });
  it('falls back to memory when storage is blocked, and ignores a corrupt value', () => {
    localStorage.setItem('vct.loupeMode', 'garbage');
    expect(['stay', 'second-finger']).toContain(getLoupeMode());
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    setLoupeMode('stay');
    expect(getLoupeMode()).toBe('stay');
  });
});

describe('loupe views (1.1)', () => {
  it('before any choice a pause peeks at details; once a view is chosen a pause no longer changes it', () => {
    expect(showsDetails('auto', false)).toBe(false);
    expect(showsDetails('auto', true)).toBe(true);
    expect(showsDetails('card', true)).toBe(false);
    expect(showsDetails('details', false)).toBe(true);
  });
  it('every way of ending a stay-open view ends it; panning and scrolling do not', () => {
    const ends: ViewingEvent[] = ['close', 'escape', 'scrubStart', 'dragStart', 'select', 'tapViewed', 'felt', 'sheet'];
    for (const e of ends) expect(endsViewing(e)).toBe(true);
    expect(endsViewing('pan')).toBe(false);
    expect(endsViewing('scroll')).toBe(false);
  });
  it('a second finger is a tap only when quick and nearly still', () => {
    expect(isQuickTap({ t: 0, x: 10, y: 10 }, { t: 120, x: 12, y: 11 })).toBe(true);
    expect(isQuickTap({ t: 0, x: 10, y: 10 }, { t: 400, x: 10, y: 10 })).toBe(false);
    expect(isQuickTap({ t: 0, x: 10, y: 10 }, { t: 100, x: 40, y: 10 })).toBe(false);
  });
});

describe('tapping the loupe steps through the views (3.1)', () => {
  it('from the card to details', () => {
    expect(toggleView('auto', false)).toEqual({ face: 'details', peek: false });
    expect(toggleView('card', false)).toEqual({ face: 'details', peek: false });
  });
  it('from details to true full, and from true full back to the card', () => {
    expect(toggleView('details', false)).toEqual({ face: 'true', peek: false });
    expect(toggleView('true', false)).toEqual({ face: 'card', peek: false });
  });
  it('a pause that is peeking at details counts as Details, so the next view is true full', () => {
    const t = toggleView('auto', true);
    expect(t).toEqual({ face: 'true', peek: false });
    expect(showsDetails(t.face, true)).toBe(false);
  });
  it('a full tour returns to where it began, and a pause never changes a chosen view', () => {
    let f: ReturnType<typeof toggleView> = { face: 'card', peek: false };
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      f = toggleView(f.face, false);
      seen.push(f.face);
    }
    expect(seen).toEqual(['details', 'true', 'card']);
    expect(showsDetails('true', true)).toBe(false);
    expect(showsTrue('true')).toBe(true);
    expect(showsTrue('details')).toBe(false);
  });
  it('the chosen view is kept for the session', () => {
    expect(getLoupeFace()).toBe('auto');
    setLoupeFace('card');
    expect(getLoupeFace()).toBe('card');
    setLoupeFace('details');
    expect(getLoupeFace()).toBe('details');
    setLoupeFace('true');
    expect(getLoupeFace()).toBe('true');
    sessionStorage.clear();
    setLoupeFace('auto');
  });
});

describe('what a second finger does on the loupe (5.1)', () => {
  const d = { t: 0, x: 100, y: 100 };
  it('a quick tap switches the view', () => {
    expect(secondFingerGesture(d, { t: 120, x: 103, y: 101 })).toBe('tap');
  });
  it('a quick sideways swipe rotates: right clockwise, left counter-clockwise', () => {
    expect(secondFingerGesture(d, { t: 200, x: 150, y: 104 })).toBe('right');
    expect(secondFingerGesture(d, { t: 200, x: 50, y: 96 })).toBe('left');
  });
  it('a slow drag, a hold, a short move or a mostly vertical swipe does nothing', () => {
    expect(secondFingerGesture(d, { t: 900, x: 160, y: 100 })).toBeNull(); // too slow
    expect(secondFingerGesture(d, { t: 450, x: 100, y: 100 })).toBeNull(); // a hold
    expect(secondFingerGesture(d, { t: 200, x: 118, y: 100 })).toBeNull(); // between a tap and a swipe
    expect(secondFingerGesture(d, { t: 200, x: 130, y: 190 })).toBeNull(); // mostly vertical
  });
});
