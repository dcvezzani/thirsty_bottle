import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { CardView, TableView, ZoneView } from '@vct/shared';
import { viewedHandDisplay, viewedHandText } from './viewedHand';
import { CardRow } from './CardRow';
import { ViewedHand } from './ViewedHand';

afterEach(cleanup);
// jsdom has no ResizeObserver; CardRow measures itself with one
vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });

const card = (h: string, known: boolean): CardView => ({ h, faceUp: known, known, deck: 'd', def: h }) as unknown as CardView;
const zone = (cards: CardView[]): ZoneView => ({ id: 'hand:s2', name: 'Hand', kind: 'hand', seatId: 's2', layout: 'spread', color: '#333', x: 0, y: 0, width: 'full', newRow: false, cards }) as ZoneView;
const view = { decks: [] } as unknown as TableView;

describe('viewed hand display (1.1)', () => {
  it('shown cards come first in hand order; the rest are only counted', () => {
    const d = viewedHandDisplay([card('a', false), card('b', true), card('c', false), card('d', true), card('e', false)]);
    expect(d.shown.map((c) => c.h)).toEqual(['b', 'd']);
    expect([d.hidden, d.total]).toEqual([3, 5]);
  });

  it('the line names the owner: empty, none shown, some shown', () => {
    const none = viewedHandDisplay([card('a', false)]);
    expect(viewedHandText('Dave', viewedHandDisplay([]))).toBe("Dave's hand is empty");
    expect(viewedHandText('Dave', none)).toBe("Dave's hand · 1 · none shown to you");
    expect(viewedHandText('Dave', viewedHandDisplay([card('a', true), card('b', false)]))).toBe("Dave's hand · 2 · 1 shown to you");
  });

  it('a hand with nothing shown is one slim line with a hidden stack; with shown cards it is the full hand', () => {
    const { container, rerender } = render(<ViewedHand view={view} zone={zone([card('a', false), card('b', false)])} name="Dave" onInfo={() => {}} last />);
    expect(screen.getByText("Dave's hand · 2 · none shown to you")).toBeTruthy();
    expect(screen.getByLabelText('2 hidden cards')).toBeTruthy();
    expect(container.querySelector('.viewed-hand.slim')).not.toBeNull();
    expect(container.querySelector('.card-row')).toBeNull();
    rerender(<ViewedHand view={view} zone={zone([card('a', false), card('b', true), card('c', false)])} name="Dave" onInfo={() => {}} last />);
    expect(container.querySelector('.viewed-hand.full')).not.toBeNull();
    expect(screen.getByText('+2 hidden')).toBeTruthy();
    expect(container.querySelectorAll('.card-row [data-h]').length).toBe(1); // only the shown card is in the row
    expect(container.querySelector('[data-drop-zone="hand:s2"]')).not.toBeNull();
  });
});

describe('CardRow empty message (1.2)', () => {
  it('a hand says "Your hand is empty" unless told otherwise', () => {
    const { rerender } = render(<CardRow zone={zone([])} decks={[]} onInfo={() => {}} />);
    expect(screen.getByText('Your hand is empty')).toBeTruthy();
    rerender(<CardRow zone={zone([])} decks={[]} onInfo={() => {}} emptyText="Dave's hand is empty" />);
    expect(screen.getByText("Dave's hand is empty")).toBeTruthy();
    expect(screen.queryByText('Your hand is empty')).toBeNull();
  });
});
