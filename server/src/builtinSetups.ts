import type { SetupContent } from '@vct/shared';

/** setup-sharing D7: the built-in setups (all use the built-in Standard 52 deck). */
export function builtInSetups(): { id: string; content: SetupContent }[] {
  const deck = [{ id: 's1', label: 'Deck', defaultDeckId: 'builtin-standard-52' }];
  return [
    {
      id: 'builtin-setup-klondike',
      content: {
        name: 'Klondike',
        players: { min: 1, max: 1 },
        slots: deck,
        homes: { s1: 'stock' },
        zones: [
          { key: 'stock', name: 'Stock', layout: 'pile', down: 0, up: 0 },
          { key: 'waste', name: 'Waste', layout: 'pile', down: 0, up: 0 },
          ...[1, 2, 3, 4].map((i) => ({ key: `f${i}`, name: `F${i}`, layout: 'pile' as const, down: 0, up: 0 })),
          ...[1, 2, 3, 4, 5, 6, 7].map((k) => ({ key: `p${k}`, name: `P${k}`, layout: 'column' as const, ...(k === 1 ? { newRow: true } : {}), down: k - 1, up: 1 })),
        ],
        counters: [],
      },
    },
    {
      id: 'builtin-setup-hearts',
      content: {
        name: 'Hearts',
        players: { min: 3, max: 6 },
        slots: deck,
        homes: { s1: 'stock' },
        zones: [
          { key: 'stock', name: 'Stock', layout: 'pile', down: 0, up: 0 },
          { key: 'trick', name: 'Trick', layout: 'spread', down: 0, up: 0 },
        ],
        hands: { count: 'rest', face: 'down' },
        counters: [{ label: '{name} points', value: 0, perSeat: true }],
      },
    },
    {
      id: 'builtin-setup-crazy-eights',
      content: {
        name: 'Crazy Eights',
        players: { min: 2, max: 7 },
        slots: deck,
        homes: { s1: 'stock' },
        zones: [
          { key: 'stock', name: 'Stock', layout: 'pile', down: 0, up: 0 },
          { key: 'discard', name: 'Discard', layout: 'pile', down: 0, up: 1 },
        ],
        hands: { count: { byPlayers: [{ min: 2, max: 2, n: 7 }, { min: 3, max: 7, n: 5 }] }, face: 'down' },
        counters: [],
      },
    },
  ];
}
