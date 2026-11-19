import { describe, it, expect } from 'vitest';
import { ActionError, defaultZoneWidth, migrateState, type TableState } from '@vct/shared';
import { ALEX, SAM, setup, run, zoneByName } from './helpers.js';

const sharedNames = (s: TableState) => s.zoneOrder.filter((id) => s.zones[id].kind === 'shared').map((id) => s.zones[id].name);
const handSlots = (s: TableState) => s.zoneOrder.map((id, i) => (s.zones[id].kind === 'hand' ? `${i}:${id}` : null)).filter(Boolean);

function withZones(names: string[]) {
  const { eng } = setup();
  let s = eng.state;
  for (const name of names) s = run(s, { type: 'zoneAdd', name, layout: 'column' }, ALEX.playerId).state;
  return s;
}

describe('zone order, width and rows (zone-arrangement 1.1)', () => {
  it('zoneMove reorders shared zones and leaves hand zones in their slots', () => {
    const s0 = withZones(['P1', 'P2', 'P3']);
    const before = sharedNames(s0);
    expect(before.slice(-3)).toEqual(['P1', 'P2', 'P3']);
    const hands = handSlots(s0);
    const r = run(s0, { type: 'zoneMove', zone: zoneByName(s0, 'P3').id, index: 0 }, ALEX.playerId);
    expect(sharedNames(r.state)).toEqual(['P3', ...before.filter((n) => n !== 'P3')]);
    expect(handSlots(r.state)).toEqual(hands);
    expect(r.state.log.at(-1)!.text).toBe('Alex moved P3');
  });

  it('clamps the index to the end and ignores a no-op move', () => {
    const s0 = withZones(['P1', 'P2']);
    const r = run(s0, { type: 'zoneMove', zone: zoneByName(s0, 'P1').id, index: 99 }, ALEX.playerId);
    expect(sharedNames(r.state).at(-1)).toBe('P1');
    const n = r.state.log.length;
    const r2 = run(r.state, { type: 'zoneMove', zone: zoneByName(r.state, 'P1').id, index: 99 }, ALEX.playerId);
    expect(r2.state.log.length).toBe(n);
  });

  it('only the host can move, resize or break rows; hands are not arranged', () => {
    const s0 = withZones(['P1']);
    const p1 = zoneByName(s0, 'P1').id;
    for (const a of [
      { type: 'zoneMove', zone: p1, index: 0 },
      { type: 'zoneUpdate', zone: p1, width: 'half' },
      { type: 'zoneUpdate', zone: p1, newRow: true },
    ] as const) {
      expect(() => run(s0, a as any, SAM.playerId)).toThrow(ActionError);
    }
    const handId = s0.zoneOrder.find((id) => s0.zones[id].kind === 'hand')!;
    expect(() => run(s0, { type: 'zoneMove', zone: handId, index: 0 }, ALEX.playerId)).toThrow(/Hands/);
  });

  it('width defaults from the layout; set, reset with null; new row on and off', () => {
    expect(['pile', 'column', 'spread', 'free'].map((l) => defaultZoneWidth(l as any))).toEqual(['fit', 'fit', 'full', 'full']);
    const s0 = withZones(['P1']);
    const p1 = zoneByName(s0, 'P1').id;
    expect(s0.zones[p1].width).toBeUndefined();
    let s = run(s0, { type: 'zoneUpdate', zone: p1, width: 'half', newRow: true }, ALEX.playerId).state;
    expect(s.zones[p1]).toMatchObject({ width: 'half', newRow: true });
    s = run(s, { type: 'zoneUpdate', zone: p1, width: null, newRow: false }, ALEX.playerId).state;
    expect(s.zones[p1].width).toBeUndefined();
    expect(s.zones[p1].newRow).toBeUndefined();
  });

  it('zoneAdd accepts the column layout, a width and a new row', () => {
    const { eng } = setup();
    const s = run(eng.state, { type: 'zoneAdd', name: 'P1', layout: 'column', width: 'half', newRow: true }, ALEX.playerId).state;
    expect(zoneByName(s, 'P1')).toMatchObject({ layout: 'column', width: 'half', newRow: true });
  });
});

describe('migrating old tables (zone-arrangement 1.2)', () => {
  function oldTable() {
    const { eng } = setup();
    let s = eng.state;
    // created in this order, laid out by position: B is above A; piles were shown first
    s = run(s, { type: 'zoneAdd', name: 'A', layout: 'spread', x: 0.5, y: 0.8 }, ALEX.playerId).state;
    s = run(s, { type: 'zoneAdd', name: 'B', layout: 'spread', x: 0.1, y: 0.3 }, ALEX.playerId).state;
    s = run(s, { type: 'zoneAdd', name: 'Pile2', layout: 'pile', x: 0.9, y: 0.95 }, ALEX.playerId).state;
    s = run(s, { type: 'zoneAdd', name: 'C', layout: 'spread', x: 0.05, y: 0.3 }, ALEX.playerId).state;
    const old = structuredClone(s);
    delete old.zoneLayoutVersion;
    return old;
  }

  it('reproduces the old visual order: piles first, then by row and column', () => {
    const old = oldTable();
    // default zones: Discard (pile, y .1), Standard deck pile, Table (spread, y .45)
    const hands = handSlots(old);
    const s = migrateState(old);
    const names = sharedNames(s);
    const piles = names.filter((n) => ['Discard', 'Standard', 'Pile2'].includes(n));
    expect(names.slice(0, piles.length)).toEqual(piles);
    expect(names.slice(piles.length)).toEqual(['C', 'B', 'Table', 'A']);
    expect(handSlots(s)).toEqual(hands);
    expect(s.zoneLayoutVersion).toBe(1);
  });

  it('is idempotent and leaves new tables alone', () => {
    const s = migrateState(oldTable());
    const order = [...s.zoneOrder];
    expect(migrateState(s).zoneOrder).toEqual(order);
    const fresh = setup().eng.state;
    expect(fresh.zoneLayoutVersion).toBe(1);
    const freshOrder = [...fresh.zoneOrder];
    expect(migrateState(fresh).zoneOrder).toEqual(freshOrder);
  });
});

describe('placing zones the table creates (zone-arrangement)', () => {
  it("a loaded deck's pile joins the leading piles; a host-added zone goes at the end", () => {
    const { eng } = setup(); // Discard (pile), Table (spread), then the Standard deck loaded
    const names = sharedNames(eng.state);
    expect(names.indexOf('Standard')).toBeLessThan(names.indexOf('Table'));
    const s = run(eng.state, { type: 'zoneAdd', name: 'Mine', layout: 'pile' }, ALEX.playerId).state;
    expect(sharedNames(s).at(-1)).toBe('Mine');
  });
});
