import { describe, expect, it } from 'vitest';
import { loupeSizes, loupeWidth, pickLoupe } from './loupe';

const view = { top: 0, bottom: 800 }; // max 480, min 280

describe('loupe placement', () => {
  it('docks at the top with the cap height when the zone is low', () => {
    expect(pickLoupe({ top: 600, bottom: 700 }, view)).toEqual({ side: 'top', y: 8, h: 480 });
  });
  it('docks at the bottom when the zone is in the upper part', () => {
    const p = pickLoupe({ top: 60, bottom: 160 }, view);
    expect(p.side).toBe('bottom');
    expect(p.h).toBe(480);
    expect(p.y + p.h).toBe(792);
    expect(p.y).toBeGreaterThanOrEqual(160);
  });
  it('takes the side with more room and ties go to the top', () => {
    expect(pickLoupe({ top: 380, bottom: 420 }, view).side).toBe('top');
    expect(pickLoupe({ top: 300, bottom: 400 }, view).side).toBe('bottom');
  });
  it('shrinks to the free room, never below the floor', () => {
    const p = pickLoupe({ top: 380, bottom: 500 }, view);
    expect(p.h).toBe(Math.floor(380 - 16));
    const q = pickLoupe({ top: 250, bottom: 560 }, view);
    expect(q.h).toBe(280);
  });
  it('respects a safe-area inset', () => {
    const p = pickLoupe({ top: 600, bottom: 700 }, { top: 44, bottom: 766 });
    expect(p.y).toBe(52);
  });
});

describe('loupe sizes', () => {
  it('fills the height on a wide loupe, with no old 200px cap', () => {
    const s = loupeSizes(480, 700, false);
    expect(s.card).toBe(Math.floor((480 - 16 - 44) / 1.4));
    expect(s.card).toBeGreaterThan(200);
  });
  it('is limited by width on a narrow one', () => {
    expect(loupeSizes(480, 200, false).card).toBeLessThanOrEqual(180);
  });
  it('stay mode leaves room for the buttons', () => {
    expect(loupeSizes(480, 700, true).card).toBeLessThan(loupeSizes(480, 700, false).card);
  });
  it('true full fits a square', () => {
    const s = loupeSizes(480, 700, false);
    expect(s.trueCard * 1.4).toBeLessThanOrEqual(480 - 16 - 44);
  });
  it('width is the view minus margins up to the cap', () => {
    expect(loupeWidth(375)).toBe(359);
    expect(loupeWidth(1280)).toBe(720);
  });
});
