import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPins, prefill, savePins, snapshot, type FormSnapshot } from './cardPins';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

const form = (over: Partial<FormSnapshot> = {}): FormSnapshot => ({
  name: 'Goblin ',
  count: '3',
  description: 'd',
  front: 'img_f',
  back: undefined,
  rows: [
    { key: 'suit', type: 'text', value: 'hearts', pin: true },
    { key: 'rank', type: 'number', value: '1' },
  ],
  abilities: [{ trigger: 'On Play', effect: 'Draw', target: 'Self' }, { trigger: 'x', effect: 'y', target: 'z' }],
  abilityPins: [false, true],
  pinned: { name: true, count: true, description: false, front: false, back: true },
  ...over,
});

describe('cardPins', () => {
  it('snapshots only pinned fields, recording current values', () => {
    const p = snapshot(form());
    expect(p).toEqual({
      name: 'Goblin ',
      count: '3',
      back: null,
      props: [{ key: 'suit', type: 'text', value: 'hearts' }],
      abilities: [{ trigger: 'x', effect: 'y', target: 'z' }],
    });
  });

  it('round-trips through storage per deck', () => {
    savePins('d1', snapshot(form()));
    expect(loadPins('d1').name).toBe('Goblin ');
    expect(loadPins('d2')).toEqual({ props: [], abilities: [] });
  });

  it('follows the last save', () => {
    savePins('d1', snapshot(form()));
    savePins('d1', snapshot(form({ rows: [{ key: 'suit', type: 'text', value: 'spades', pin: true }] })));
    expect(loadPins('d1').props[0].value).toBe('spades');
  });

  it('falls back to memory when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    savePins('d9', snapshot(form()));
    expect(loadPins('d9').count).toBe('3');
  });

  it('prefills pinned values and merges template keys with blank values', () => {
    const s = prefill(snapshot(form()), [
      { key: 'suit', type: 'text' },
      { key: 'rank', type: 'number' },
      { key: 'face', type: 'boolean' },
    ]);
    expect(s.name).toBe('Goblin ');
    expect(s.count).toBe('3');
    expect(s.description).toBe('');
    expect(s.rows).toEqual([
      { key: 'suit', type: 'text', value: 'hearts', pin: true },
      { key: 'rank', type: 'number', value: '' },
      { key: 'face', type: 'boolean', value: 'false' },
    ]);
    expect(s.abilityPins).toEqual([true]);
    expect(s.pinned).toEqual({ name: true, count: true, description: false, front: false, back: true });
  });

  it('prefills defaults with no pins', () => {
    const s = prefill({ props: [], abilities: [] }, []);
    expect(s).toMatchObject({ name: '', count: '1', description: '', rows: [], abilities: [] });
  });
});
