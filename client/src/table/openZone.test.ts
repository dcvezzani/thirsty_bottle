import { beforeEach, describe, expect, it } from 'vitest';
import { useUI } from './ui';

beforeEach(() => useUI.setState({ openZone: null, selZone: null, selected: [] }));

describe('pinned open zones (4.2)', () => {
  it('clearing the selection closes a pinned zone', () => {
    useUI.setState({ openZone: { id: 'z1', pinned: true } });
    useUI.getState().select('z1', ['a', 'b']);
    useUI.getState().clear();
    expect(useUI.getState().openZone).toBeNull();
  });
  it('selecting and deselecting cards never closes it, and the selection survives it closing', () => {
    useUI.setState({ openZone: { id: 'z1', pinned: true } });
    useUI.getState().toggle('z1', 'a');
    useUI.getState().toggle('z1', 'b');
    useUI.getState().toggle('z1', 'a');
    expect(useUI.getState().openZone).toEqual({ id: 'z1', pinned: true });
    useUI.setState({ openZone: null });
    expect(useUI.getState().selected).toEqual(['b']);
  });
  it('clearing the selection leaves a zone opened by a held drag alone (the drag ends it)', () => {
    useUI.setState({ openZone: { id: 'z2', pinned: false } });
    useUI.getState().clear();
    expect(useUI.getState().openZone).toEqual({ id: 'z2', pinned: false });
  });
});
