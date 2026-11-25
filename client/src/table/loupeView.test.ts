import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultLoupeMode, getLoupeMode, setLoupeMode } from '../lib/loupePrefs';
import { endsViewing, flipFace, isQuickTap, showsDetails, type ViewingEvent } from './loupeView';

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
  it('details show when chosen or while a pause peeks at them', () => {
    expect(showsDetails('card', false)).toBe(false);
    expect(showsDetails('card', true)).toBe(true);
    expect(showsDetails('details', false)).toBe(true);
    expect(flipFace('card')).toBe('details');
    expect(flipFace('details')).toBe('card');
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
