import { describe, expect, it } from 'vitest';
import { decide } from './sharedPhone';

const people = [
  { token: 'th', id: 'host', name: 'Alex', color: '#111111' },
  { token: 'ts', id: 'sam', name: 'Sam', color: '#222222' },
  { token: 'tk', id: 'kim', name: 'Kim', color: '#333333' },
];
const seats = [
  { id: 's1', playerId: 'host', name: 'Alex' },
  { id: 's2', playerId: 'sam', name: 'Sam' },
  { id: 's3', playerId: 'kim', name: 'Kim' },
  { id: 's4', playerId: 'remy', name: 'Remy' },
] as any;
const view = (active: string | null, me = 'sam', mode: 'turn' | 'realtime' = 'turn') =>
  ({ mode, turn: { active, direction: 1 }, seats, me: { playerId: me } }) as any;

describe('shared phone covers', () => {
  it('does nothing when nobody shares the phone', () => {
    expect(decide(view('s3'), [], null, 's2')).toEqual({ cover: null });
    expect(decide(view('s3'), [people[0]], null, 's2')).toEqual({ cover: null });
  });
  it('passes to the next person on the phone: cover first, switch at once', () => {
    const d = decide(view('s3', 'sam'), people, null, 's2');
    expect(d.cover).toEqual({ kind: 'pass', personId: 'kim' });
    expect(d.switchTo?.token).toBe('tk');
  });
  it('once connected as that person the cover stays until it is tapped away', () => {
    const cur = { kind: 'pass', personId: 'kim' } as const;
    expect(decide(view('s3', 'kim'), people, cur, 's3').cover).toEqual(cur);
    expect(decide(view('s3', 'kim'), people, null, 's3').cover).toBeNull(); // tapped
  });
  it('turn-based play starting on the connected person needs no cover', () => {
    expect(decide(view('s2', 'sam'), people, null, null).cover).toBeNull();
  });
  it('covers a remote player\'s turn with a waiting cover and no switch', () => {
    const d = decide(view('s4', 'sam'), people, null, 's2');
    expect(d).toEqual({ cover: { kind: 'wait', name: 'Remy' } });
  });
  it('when the turn returns to the connected person from a waiting cover it becomes a handoff cover', () => {
    const d = decide(view('s2', 'sam'), people, { kind: 'wait', name: 'Remy' }, 's4');
    expect(d.cover).toEqual({ kind: 'pass', personId: 'sam' });
    expect(d.switchTo).toBeUndefined();
  });
  it('when the turn returns to a different person on the phone it switches to them', () => {
    const d = decide(view('s3', 'sam'), people, { kind: 'wait', name: 'Remy' }, 's4');
    expect(d.cover).toEqual({ kind: 'pass', personId: 'kim' });
    expect(d.switchTo?.id).toBe('kim');
  });
  it('a person without a token here (lost) is treated as waiting', () => {
    const d = decide(view('s3', 'sam'), people.filter((p) => p.id !== 'kim'), null, 's2');
    expect(d.cover).toEqual({ kind: 'wait', name: 'Kim' });
  });
  it('real-time mode has no automatic handoff and clears a waiting cover, keeping a manual one', () => {
    expect(decide(view('s3', 'sam', 'realtime'), people, { kind: 'wait', name: 'x' }, 's2').cover).toBeNull();
    const pick = { kind: 'pick' } as const;
    expect(decide(view('s3', 'sam', 'realtime'), people, pick, 's2').cover).toEqual(pick);
  });
  it('no active seat: no waiting cover', () => {
    expect(decide(view(null), people, { kind: 'wait', name: 'x' }, 's2').cover).toBeNull();
  });
});
