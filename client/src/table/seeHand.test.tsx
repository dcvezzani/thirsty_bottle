import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { CardView, TableView, ZoneView } from '@vct/shared';
import { canAskToSee, hasShownCards } from './seeHand';
import { AskToSee, StopShowingHand } from './HandControls';
import { Prompts, SeatSheet } from './Sheets';
import { useTable } from '../store/table';

vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
const send = vi.fn();
/** The action of the latest send (Sheets.tsx also passes an optional predictor as a second argument). */
const lastAction = () => send.mock.calls.at(-1)?.[0];
const original = useTable.getState().send;
useTable.setState({ send } as never);
afterEach(() => {
  cleanup();
  send.mockClear();
});
void original;

const card = (h: string, known: boolean, shownTo?: string[]): CardView => ({ h, faceUp: known, known, deck: 'd', def: h, ...(shownTo ? { shownTo } : {}) }) as unknown as CardView;
const hand = (seatId: string, cards: CardView[]) => ({ id: `hand:${seatId}`, name: 'Hand', kind: 'hand', seatId, layout: 'spread', cards }) as unknown as ZoneView;
const base = (over: Record<string, unknown> = {}) =>
  ({
    me: { playerId: 'pd', seatId: 's2', isHost: false, spectator: false },
    seats: [
      { id: 's1', playerId: 'pg', name: 'George', index: 0, handCount: 3 },
      { id: 's2', playerId: 'pd', name: 'Dave', index: 1, handCount: 1 },
      { id: 's3', playerId: null, name: '', index: 2, handCount: 0 },
    ],
    zones: [hand('s1', [card('a', false), card('b', false), card('c', true)]), hand('s2', [card('m', true)]), hand('s3', [])],
    requests: [],
    vacated: [],
    decks: [],
    settings: { openHands: false },
    ...over,
  }) as unknown as TableView;

describe('when the ask control is offered (3.1)', () => {
  it('offered for a hand with hidden cards; pending shows Asked…; never for my own, an empty seat, a spectator, or a fully shown hand', () => {
    expect(canAskToSee(base(), 's1')).toBe('ask');
    const pending = base({ requests: [{ id: 'r1', kind: 'see', dir: 'outgoing', seatId: 's1', from: 'pd', fromName: 'Dave', count: 0, to: '' }] });
    expect(canAskToSee(pending, 's1')).toBe('pending');
    expect(canAskToSee(base(), 's2')).toBeNull(); // my own
    expect(canAskToSee(base(), 's3')).toBeNull(); // empty seat
    expect(canAskToSee(base({ me: { playerId: 'x', seatId: null, isHost: false, spectator: true } }), 's1')).toBeNull();
    expect(canAskToSee(base({ zones: [hand('s1', [card('a', true), card('b', true)])] }), 's1')).toBeNull(); // nothing hidden
    expect(canAskToSee(base(), null)).toBeNull();
  });

  it('the button asks, and waits as "Asked…"', () => {
    render(<AskToSee view={base()} seatId="s1" />);
    fireEvent.click(screen.getByLabelText('Ask to see hand'));
    expect(send).toHaveBeenCalledWith({ type: 'seeAsk', seat: 's1' });
    cleanup();
    const pending = base({ requests: [{ id: 'r1', kind: 'see', dir: 'outgoing', seatId: 's1', from: 'pd', fromName: 'Dave', count: 0, to: '' }] });
    render(<AskToSee view={pending} seatId="s1" />);
    const b = screen.getByLabelText('Asked to see hand') as HTMLButtonElement;
    expect(b.textContent).toBe('Asked…');
    expect(b.disabled).toBe(true);
  });

  it('the seat sheet offers the same action', () => {
    render(<SeatSheet view={base()} seatId="s1" onClose={() => {}} />);
    fireEvent.click(screen.getByText('Ask to see hand'));
    expect(lastAction()).toEqual({ type: 'seeAsk', seat: 's1' });
  });

  it('the owner\'s prompt names the asker; Allow and Decline answer; the asker sees a waiting banner with Cancel', () => {
    const incoming = base({ me: { playerId: 'pg', seatId: 's1', isHost: false, spectator: false }, requests: [{ id: 'r1', kind: 'see', dir: 'incoming', seatId: 's1', from: 'pd', fromName: 'Dave', count: 0, to: '' }] });
    const { unmount } = render(<Prompts view={incoming} />);
    expect(screen.getByText('Dave asks to see your hand')).toBeTruthy();
    fireEvent.click(screen.getByText('Allow'));
    expect(lastAction()).toEqual({ type: 'seeRespond', requestId: 'r1', approve: true });
    fireEvent.click(screen.getByText('Decline'));
    expect(lastAction()).toEqual({ type: 'seeRespond', requestId: 'r1', approve: false });
    unmount();
    const outgoing = base({ requests: [{ id: 'r2', kind: 'see', dir: 'outgoing', seatId: 's1', from: 'pd', fromName: 'Dave', count: 0, to: '' }] });
    render(<Prompts view={outgoing} />);
    expect(screen.getByText('Waiting for George to let you see their hand…')).toBeTruthy();
    fireEvent.click(screen.getByText('Cancel'));
    expect(lastAction()).toEqual({ type: 'seeCancel', requestId: 'r2' });
  });
});

describe('stop showing my hand (3.2)', () => {
  it('is offered only while a card of my hand is shown, and unshows every hand card', () => {
    const idle = hand('s2', [card('a', true), card('b', true)]);
    const { container, rerender } = render(<StopShowingHand hand={idle} />);
    expect(container.firstChild).toBeNull();
    expect(hasShownCards(idle.cards)).toBe(false);
    rerender(<StopShowingHand hand={hand('s2', [card('a', true, ['pg']), card('b', true)])} />);
    fireEvent.click(screen.getByLabelText('Stop showing my hand'));
    expect(send).toHaveBeenCalledWith({ type: 'unshow', cards: ['a', 'b'] });
  });
});
