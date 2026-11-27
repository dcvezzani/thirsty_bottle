import { describe, it, expect } from 'vitest';
import { ActionSchema, CardDefSchema, ClientMessageSchema, DeckContentSchema } from '@vct/shared';

describe('card schemas', () => {
  it('accepts a card with typed metadata and abilities', () => {
    const r = CardDefSchema.safeParse({
      id: 'k',
      name: 'Knight',
      count: 2,
      metadata: { suit: 'Hearts', rank: 12, royal: true, tags: ['a', 'b'] },
      abilities: [{ trigger: 'On Play', effect: 'Draw Card', value: 2, target: 'Self' }],
    });
    expect(r.success).toBe(true);
  });
  it('rejects zero and negative instance counts', () => {
    expect(CardDefSchema.safeParse({ id: 'k', name: 'K', count: 0 }).success).toBe(false);
    expect(CardDefSchema.safeParse({ id: 'k', name: 'K', count: -1 }).success).toBe(false);
  });
  it('rejects nested-object metadata and bad image ids', () => {
    expect(CardDefSchema.safeParse({ id: 'k', name: 'K', count: 1, metadata: { a: { b: 1 } } }).success).toBe(false);
    expect(CardDefSchema.safeParse({ id: 'k', name: 'K', count: 1, frontImageId: 'nope' }).success).toBe(false);
  });
  it('rejects duplicate card ids in a deck', () => {
    const r = DeckContentSchema.safeParse({
      name: 'D',
      cards: [
        { id: 'a', name: 'A', count: 1 },
        { id: 'a', name: 'B', count: 1 },
      ],
    });
    expect(r.success).toBe(false);
  });
});

describe('action and message schemas', () => {
  it('accepts valid actions', () => {
    for (const a of [
      { type: 'move', cards: ['h1'], to: 'z1', face: 'down' },
      { type: 'draw', zone: 'z1', count: 2, from: 'random' },
      { type: 'deal', zone: 'z1', count: 13, seats: ['s1', 's2'] },
      { type: 'show', cards: ['h1'], to: 'all' },
      { type: 'setMode', mode: 'turn' },
    ])
      expect(ActionSchema.safeParse(a).success, JSON.stringify(a)).toBe(true);
  });
  it('rejects malformed actions', () => {
    for (const a of [
      { type: 'move', cards: [], to: 'z1' },
      { type: 'draw', zone: 'z1', count: 0, from: 'top' },
      { type: 'explode' },
      { type: 'show', cards: ['h'], to: [] },
    ])
      expect(ActionSchema.safeParse(a).success, JSON.stringify(a)).toBe(false);
  });
  it('accepts a minimal table.create with optional seat count and password', () => {
    const r = ClientMessageSchema.safeParse({ t: 'table.create', name: 'Quick Game' });
    expect(r.success).toBe(true);
    if (r.success && r.data.t === 'table.create') {
      expect(r.data.seatLimit).toBeUndefined();
      expect(r.data.password).toBeUndefined();
      expect(r.data.visibility).toBe('public');
    }
  });
  it('rejects unknown message types and missing fields', () => {
    expect(ClientMessageSchema.safeParse({ t: 'table.intent', tableId: 't' }).success).toBe(false);
    expect(ClientMessageSchema.safeParse({ t: 'nope' }).success).toBe(false);
  });
});

describe('async-turns idleDays schema', () => {
  it('accepts 1 to 30 whole days and refuses the rest', () => {
    for (const ok of [1, 7, 30]) expect(ActionSchema.safeParse({ type: 'settings', idleDays: ok }).success).toBe(true);
    for (const bad of [0, 31, 1.5, -1]) expect(ActionSchema.safeParse({ type: 'settings', idleDays: bad }).success).toBe(false);
  });
});
