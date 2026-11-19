import { afterEach, describe, expect, it } from 'vitest';
import { useTable } from '../store/table';
import { useUI } from './ui';
import { quickFlip, flipSelection } from './flip';

const sent: any[] = [];
afterEach(() => {
  sent.length = 0;
  useUI.setState({ selZone: null, selected: [] });
});
useTable.setState({ send: ((a: any) => (sent.push(a), Promise.resolve({ ok: true }))) as any });

describe('quick flip selection rules (quick-flip 1.2)', () => {
  it('a card in the selection flips the whole selection, then clears it', async () => {
    useUI.setState({ selZone: 'z1', selected: ['a', 'b', 'c'] });
    await quickFlip('z1', 'b');
    expect(sent).toEqual([{ type: 'flip', cards: ['a', 'b', 'c'] }]);
    expect(useUI.getState().selected).toEqual([]);
  });
  it('a card outside the selection flips alone and leaves the selection', async () => {
    useUI.setState({ selZone: 'z1', selected: ['a', 'b'] });
    await quickFlip('z1', 'x');
    expect(sent).toEqual([{ type: 'flip', cards: ['x'] }]);
    expect(useUI.getState().selected).toEqual(['a', 'b']);
  });
  it('a selection in another zone does not count', async () => {
    useUI.setState({ selZone: 'z2', selected: ['a'] });
    await quickFlip('z1', 'a');
    expect(sent).toEqual([{ type: 'flip', cards: ['a'] }]);
    expect(useUI.getState().selected).toEqual(['a']);
  });
  it('flipSelection with nothing selected sends nothing', async () => {
    await flipSelection();
    expect(sent).toEqual([]);
  });
});
