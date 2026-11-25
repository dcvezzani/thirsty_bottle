import { describe, expect, it } from 'vitest';
import { pickLoupe } from './loupe';

const board = { top: 50, bottom: 600 };

describe('loupe placement (2.1)', () => {
  it('goes to the top when the zone is low enough', () => {
    expect(pickLoupe({ top: 400, bottom: 500 }, board)).toMatchObject({ side: 'top', y: 58, h: 300 });
  });
  it('goes to the bottom when the zone is in the upper part of the board', () => {
    const p = pickLoupe({ top: 60, bottom: 160 }, board);
    expect(p).toMatchObject({ side: 'bottom', h: 300 });
    expect(p.y + p.h).toBeLessThanOrEqual(board.bottom);
    expect(p.y).toBeGreaterThanOrEqual(160); // below the zone
  });
  it('a zone below the board (the hand dock) gets the top', () => {
    expect(pickLoupe({ top: 640, bottom: 720 }, board).side).toBe('top');
  });
  it('a zone in the middle takes the roomier side with a smaller loupe', () => {
    const p = pickLoupe({ top: 250, bottom: 380 }, board);
    expect(p.h).toBeLessThan(300);
    expect(p.h).toBeGreaterThanOrEqual(170);
  });
});
