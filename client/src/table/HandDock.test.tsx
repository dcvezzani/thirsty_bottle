import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { CardView, TableView, ZoneView } from '@vct/shared';
import { HandDock } from './HandDock';
import { useUI } from './ui';

// jsdom has no ResizeObserver; CardRow measures itself with one
vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
afterEach(() => {
  cleanup();
  useUI.setState({ handFocus: 'viewed', drag: null });
});

const card = (h: string, known: boolean): CardView => ({ h, faceUp: known, known, deck: 'd', def: h }) as unknown as CardView;
const zone = (id: string, seatId: string, cards: CardView[]): ZoneView => ({ id, name: 'Hand', kind: 'hand', seatId, layout: 'spread', color: '#333', x: 0, y: 0, width: 'full', newRow: false, cards }) as ZoneView;
const view = { decks: [] } as unknown as TableView;
const mount = (viewedCards: CardView[], mineCards: CardView[] | null = [card('m1', true)]) =>
  render(<HandDock view={view} viewed={zone('hand:s2', 's2', viewedCards)} mine={mineCards ? zone('hand:s1', 's1', mineCards) : undefined} name="Sam" onInfo={() => {}} />);

describe('HandDock content (2.1, 2.2)', () => {
  it('their column is focused by default; the badge counts; hidden cards are one stack', () => {
    const { container } = mount([card('a', true), card('b', false), card('c', false)]);
    expect(screen.getByTestId('viewed-col').className).toContain('focused');
    expect(screen.getByTestId('mine-col').className).toContain('narrow');
    expect(screen.getByText('Sam · 3 · 1 shown')).toBeTruthy();
    expect(screen.getByText('You · 1')).toBeTruthy();
    expect(screen.getByText('+2 hidden')).toBeTruthy();
    expect(container.querySelectorAll('[data-testid="row-viewed-hand"] [data-h]').length).toBe(1);
  });

  it('nothing shown: just the stack and a "none shown" badge; empty: the owner says so', () => {
    const { container, unmount } = mount([card('a', false), card('b', false)]);
    expect(screen.getByText('Sam · 2 · none shown')).toBeTruthy();
    expect(screen.getByLabelText('2 hidden cards')).toBeTruthy();
    expect(container.querySelectorAll('[data-testid="row-viewed-hand"] [data-h]').length).toBe(0);
    unmount();
    mount([]);
    expect(screen.getByText("Sam's hand is empty")).toBeTruthy();
    expect(screen.queryByText('Your hand is empty')).toBeNull();
  });

  it('a spectator gets one full-width column', () => {
    mount([card('a', true)], null);
    expect(screen.getByTestId('viewed-col').className).toContain('solo');
    expect(screen.queryByTestId('mine-col')).toBeNull();
  });

  it('the focus follows the state; a carried card over my narrow column focuses it, not the column it came from', () => {
    mount([card('a', true)]);
    act(() => useUI.setState({ drag: { handles: ['x'], fromZone: 'hand:s2', x: 0, y: 0, over: { kind: 'zone', zone: 'hand:s1' } } }));
    expect(useUI.getState().handFocus).toBe('mine');
    expect(screen.getByTestId('mine-col').className).toContain('focused');
    // carrying a card out of my own column and hovering it again does not focus it
    act(() => useUI.setState({ handFocus: 'viewed', drag: { handles: ['x'], fromZone: 'hand:s1', x: 0, y: 0, over: { kind: 'zone', zone: 'hand:s1' } } }));
    expect(useUI.getState().handFocus).toBe('viewed');
  });

  it('a card newly shown while my hand is focused pulses their narrow column and leaves the focus alone', () => {
    useUI.setState({ handFocus: 'mine' });
    const { rerender } = mount([card('a', false)]);
    expect(screen.getByTestId('viewed-col').className).not.toContain('pulse');
    rerender(<HandDock view={view} viewed={zone('hand:s2', 's2', [card('a', true)])} mine={zone('hand:s1', 's1', [card('m1', true)])} name="Sam" onInfo={() => {}} />);
    expect(screen.getByTestId('viewed-col').className).toContain('pulse');
    expect(useUI.getState().handFocus).toBe('mine');
    expect(screen.getByText('Sam · 1 · 1 shown')).toBeTruthy();
  });
});
