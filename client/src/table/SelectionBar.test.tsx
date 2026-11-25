import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { CardView, TableView, ZoneView } from '@vct/shared';
import { CardsSheet, SelectionBar } from './Sheets';
import { useSelectionDrawer } from './useSelectionDrawer';
import { useUI } from './ui';

vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
afterEach(() => {
  cleanup();
  useUI.setState({ selZone: null, selected: [], faceDown: false, drawer: null, sheet: null, recent: [] });
});

const card = (h: string): CardView => ({ h, faceUp: true, known: true, deck: 'd', def: h }) as unknown as CardView;
const zone = (id: string, name: string, cards: CardView[]): ZoneView => ({ id, name, kind: 'shared', seatId: null, layout: 'spread', color: '#333', x: 0, y: 0, width: 'full', newRow: false, cards }) as ZoneView;
const view = {
  zones: [zone('z1', 'Table', [card('a'), card('b'), card('c')]), zone('z2', 'Discard', [])],
  seats: [],
  decks: [],
  settings: { openHands: false },
  me: { playerId: 'p', seatId: 's1', isHost: false, spectator: false },
} as unknown as TableView;
const select = (...h: string[]) => act(() => useUI.getState().select('z1', h));

describe('selection toolbar (1.1, 1.2)', () => {
  it('is one line: count, clear, flip, send again, actions; nothing else', () => {
    useUI.setState({ recent: ['z2'] });
    select('a');
    render(<SelectionBar view={view} />);
    expect(screen.getByTestId('selection-count').textContent).toBe('1 selected');
    expect(screen.getByLabelText('Clear selection')).toBeTruthy();
    expect(screen.getByText('Flip')).toBeTruthy();
    expect(screen.getByLabelText('Send again to Discard').textContent).toBe('→ Discard');
    expect(screen.getByLabelText('Actions…')).toBeTruthy();
    // moved into the actions sheet
    expect(screen.queryByText('Select all')).toBeNull();
    expect(screen.queryByText('Clear')).toBeNull();
    expect(screen.queryByText(/Face down/)).toBeNull();
  });

  it('the clear control empties the selection', () => {
    select('a', 'b');
    render(<SelectionBar view={view} />);
    fireEvent.click(screen.getByLabelText('Clear selection'));
    expect(useUI.getState().selected).toEqual([]);
  });

  it('shows a face down tag while that mode is on, and an unread dot only with unread chat', () => {
    select('a');
    const { rerender } = render(<SelectionBar view={view} />);
    expect(screen.queryByText('face down')).toBeNull();
    expect(screen.queryByLabelText('Unread chat')).toBeNull();
    act(() => useUI.setState({ faceDown: true }));
    rerender(<SelectionBar view={view} unread={3} />);
    expect(screen.getByText('face down')).toBeTruthy();
    expect(screen.getByLabelText('Unread chat')).toBeTruthy();
  });

  it('renders nothing for a spectator or with no selection', () => {
    const { container, rerender } = render(<SelectionBar view={view} />);
    expect(container.firstChild).toBeNull();
    select('a');
    rerender(<SelectionBar view={{ ...view, me: { ...view.me, spectator: true } } as TableView} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('actions sheet carries the rest (1.2)', () => {
  it('Select all selects the whole zone and closes; Clear empties; Face down toggles the setting', () => {
    select('a');
    const onClose = vi.fn();
    render(<CardsSheet view={view} onClose={onClose} />);
    fireEvent.click(screen.getByText('Select all'));
    expect(useUI.getState().selected).toEqual(['a', 'b', 'c']);
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByLabelText(/Face down/));
    expect(useUI.getState().faceDown).toBe(true);
    fireEvent.click(screen.getByText('Clear'));
    expect(useUI.getState().selected).toEqual([]);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('drawer closes when a selection starts (1.3)', () => {
  function Host({ selecting }: { selecting: boolean }) {
    useSelectionDrawer(selecting);
    return null;
  }
  it('closes an open drawer on the first selection, and leaves it alone otherwise', () => {
    useUI.setState({ drawer: 'room' });
    const { rerender } = render(<Host selecting={false} />);
    expect(useUI.getState().drawer).toBe('room');
    rerender(<Host selecting />);
    expect(useUI.getState().drawer).toBeNull();
    act(() => useUI.setState({ drawer: 'log' })); // opened later, while still selecting: not touched
    rerender(<Host selecting />);
    expect(useUI.getState().drawer).toBe('log');
  });
});
