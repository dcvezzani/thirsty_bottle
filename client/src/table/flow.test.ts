import { describe, expect, it } from 'vitest';
import { GAP, MIN_CARD_W, flowRows, type FlowZone } from './flow';

const z = (id: string, layout: FlowZone['layout'], width: FlowZone['width'] = layout === 'pile' || layout === 'column' ? 'fit' : 'full', newRow = false): FlowZone => ({ id, layout, width, newRow });
const solitaire = (): FlowZone[] => [
  z('stock', 'pile'),
  z('waste', 'pile'),
  ...['F1', 'F2', 'F3', 'F4'].map((n) => z(n, 'pile')),
  z('P1', 'column', 'fit', true),
  ...['P2', 'P3', 'P4', 'P5', 'P6', 'P7'].map((n) => z(n, 'column')),
];
const ids = (rows: ReturnType<typeof flowRows>) => rows.map((r) => r.map((i) => i.id));
const rowW = (r: ReturnType<typeof flowRows>[number]) => r.reduce((t, i) => t + i.w, 0) + GAP * (r.length - 1);

describe('flowRows (zone-arrangement 2.1)', () => {
  it('Solitaire on a 375px phone: piles on one row, all seven columns side by side', () => {
    const board = 375 - 12; // board padding 6px each side
    const rows = flowRows(solitaire(), board, 64);
    expect(ids(rows)).toEqual([
      ['stock', 'waste', 'F1', 'F2', 'F3', 'F4'],
      ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'],
    ]);
    for (const r of rows) expect(rowW(r)).toBeLessThanOrEqual(board);
    expect(rows[1][0].cardW).toBeGreaterThanOrEqual(MIN_CARD_W);
    expect(rows[1][0].cardW).toBeLessThan(64); // shrunk to fit
  });

  it('Solitaire on desktop: same order, cards at full size', () => {
    const rows = flowRows(solitaire(), 1280 - 12, 80);
    expect(ids(rows)).toEqual([
      ['stock', 'waste', 'F1', 'F2', 'F3', 'F4'],
      ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'],
    ]);
    expect(rows.flat().map((i) => i.cardW)).toEqual(Array(13).fill(80));
  });

  it('without a row break the order simply flows (pile row continues into the columns on desktop)', () => {
    const zs = solitaire();
    zs[6].newRow = false;
    expect(flowRows(zs, 1268, 80)).toHaveLength(1);
  });

  it('half + half share a row; a full zone always takes its own row, even mid-order', () => {
    const rows = flowRows([z('a', 'spread', 'half'), z('b', 'spread', 'half'), z('p', 'pile'), z('t', 'spread'), z('q', 'pile')], 600, 64);
    expect(ids(rows)).toEqual([['a', 'b'], ['p'], ['t'], ['q']]);
    expect(rows[0][0].w).toBe(rows[0][1].w);
    expect(rowW(rows[0])).toBeLessThanOrEqual(600);
    expect(rows[2][0].w).toBe(600);
  });

  it('wraps only once the minimum card size is reached', () => {
    const many = Array.from({ length: 12 }, (_, i) => z(`c${i}`, 'column'));
    const rows = flowRows(many, 363, 64);
    expect(rows.length).toBe(2);
    expect(rows.flat().every((i) => i.cardW >= MIN_CARD_W)).toBe(true);
    for (const r of rows) expect(rowW(r)).toBeLessThanOrEqual(363);
  });
});

describe('arrangeRows (zone-arrangement 4.2)', () => {
  it('fit tiles get room for their controls; same row rules', async () => {
    const { arrangeRows, TILE_FIT_W } = await import('./flow');
    const rows = arrangeRows(solitaire(), 363);
    expect(rows.flat().every((i) => i.w === TILE_FIT_W)).toBe(true);
    expect(rows[0].map((i) => i.id)).toEqual(['stock', 'waste', 'F1']);
    // P1 starts a new row
    const p1Row = rows.find((r) => r.some((i) => i.id === 'P1'))!;
    expect(p1Row[0].id).toBe('P1');
    for (const r of rows) expect(rowW(r)).toBeLessThanOrEqual(363);
  });
});

describe('opened zone (4.1)', () => {
  const z = (id: string, layout: 'spread' | 'pile', width: 'fit' | 'half' = 'fit') => ({ id, layout, width, newRow: false }) as any;
  it('the opened zone takes the room the others do not need, and they shrink to the smallest cards', () => {
    const rows = flowRows([z('a', 'pile'), z('b', 'spread'), z('c', 'pile')], 375, 64, 'b');
    const [a, b, c] = rows[0];
    expect(a.cardW).toBe(40);
    expect(c.cardW).toBe(40);
    expect(b.w).toBeGreaterThan(375 / 2);
    expect(a.w + b.w + c.w + 8).toBeLessThanOrEqual(375);
    expect(b.cardW).toBe(64);
  });
  it('a row without the opened zone is unchanged', () => {
    const plain = flowRows([z('a', 'pile'), z('b', 'spread')], 375, 64);
    const withOther = flowRows([z('a', 'pile'), z('b', 'spread')], 375, 64, 'nope');
    expect(withOther).toEqual(plain);
  });
  it('a half or full zone opens as it is', () => {
    const plain = flowRows([z('a', 'pile'), z('b', 'spread', 'half')], 375, 64);
    expect(flowRows([z('a', 'pile'), z('b', 'spread', 'half')], 375, 64, 'b')).toEqual(plain);
  });
});

describe('room for rotated cards in the flow (3.1)', () => {
  const z = (id: string, layout: 'spread' | 'pile' | 'column', padX = 0) => ({ id, layout, width: 'fit', newRow: false, padX }) as any;
  it('a fit zone with rotated cards is wider by the room on both sides', () => {
    const plain = flowRows([z('a', 'column')], 375, 64)[0][0];
    const turned = flowRows([z('a', 'column', 0.35)], 375, 64)[0][0];
    expect(turned.cardW).toBe(plain.cardW);
    expect(turned.w - plain.w).toBeGreaterThanOrEqual(Math.floor(2 * 0.35 * 64) - 1);
    const pile = flowRows([z('p', 'pile')], 375, 64)[0][0];
    const pileTurned = flowRows([z('p', 'pile', 0.2)], 375, 64)[0][0];
    expect(pileTurned.w - pile.w).toBeGreaterThanOrEqual(Math.floor(2 * 0.2 * 64) - 1);
  });
  it('without padX nothing changes', () => {
    const a = flowRows([z('a', 'pile'), z('b', 'spread'), z('c', 'column')], 375, 64);
    const b = flowRows([z('a', 'pile', 0), z('b', 'spread', 0), z('c', 'column', 0)], 375, 64);
    expect(b).toEqual(a);
  });
  it('a widened zone makes its row-mates shrink or wrap, and the row still fits the board', () => {
    const base = [z('a', 'pile'), z('b', 'column'), z('c', 'pile'), z('d', 'column'), z('e', 'pile'), z('f', 'column')];
    const tight = base.map((q, i) => (i === 1 ? { ...q, padX: 0.7 } : q));
    const rows = flowRows(tight, 375, 64);
    for (const row of rows) expect(row.reduce((t, i) => t + i.w, 0) + GAP * (row.length - 1)).toBeLessThanOrEqual(375);
    const b = rows.flat().find((i) => i.id === 'b')!;
    // the widened column holds its card plus the room on both sides (inner width = cardW * (1 + 2 * 0.7)), plus the zone's chrome
    expect(b.w).toBeGreaterThanOrEqual(Math.floor(b.cardW * 2.4 + 8) - 1);
    // and the others still fit: every card is at least the smallest card size
    for (const i of rows.flat()) expect(i.cardW).toBeGreaterThanOrEqual(40);
  });
});
