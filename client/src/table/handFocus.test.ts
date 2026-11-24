import { describe, expect, it } from 'vitest';
import type { CardView } from '@vct/shared';
import { handBadgeText, nextFocus, shownIncreased, viewedHandDisplay } from './handFocus';

const card = (h: string, known: boolean) => ({ h, known }) as unknown as CardView;

describe('hand focus rules (1.1)', () => {
  it('a slide or a carried card focuses that column; a tap never changes it', () => {
    expect(nextFocus('viewed', { kind: 'scrub', column: 'mine' })).toBe('mine');
    expect(nextFocus('mine', { kind: 'scrub', column: 'viewed' })).toBe('viewed');
    expect(nextFocus('viewed', { kind: 'carry', column: 'mine' })).toBe('mine');
    expect(nextFocus('mine', { kind: 'tap', column: 'viewed' })).toBe('mine');
    expect(nextFocus('viewed', { kind: 'tap', column: 'mine' })).toBe('viewed');
  });

  it('activity in the already focused column changes nothing', () => {
    expect(nextFocus('viewed', { kind: 'scrub', column: 'viewed' })).toBe('viewed');
    expect(nextFocus('mine', { kind: 'carry', column: 'mine' })).toBe('mine');
  });
});

describe('viewed column content (2.1, 2.2)', () => {
  it('shown cards come first in hand order; the rest are only counted', () => {
    const d = viewedHandDisplay([card('a', false), card('b', true), card('c', false), card('d', true), card('e', false)]);
    expect(d.shown.map((c) => c.h)).toEqual(['b', 'd']);
    expect([d.hidden, d.total]).toEqual([3, 5]);
  });

  it('the badge names the owner: empty, none shown, some shown', () => {
    expect(handBadgeText('Sam', viewedHandDisplay([]))).toBe('Sam · empty');
    expect(handBadgeText('Sam', viewedHandDisplay([card('a', false), card('b', false)]))).toBe('Sam · 2 · none shown');
    expect(handBadgeText('Sam', viewedHandDisplay([card('a', true), card('b', false), card('c', false)]))).toBe('Sam · 3 · 1 shown');
  });

  it('the pulse condition: only when the number shown goes up', () => {
    expect(shownIncreased(0, 1)).toBe(true);
    expect(shownIncreased(2, 2)).toBe(false);
    expect(shownIncreased(3, 1)).toBe(false);
  });
});
