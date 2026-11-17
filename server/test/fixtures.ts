import type { TableDeck } from '@vct/shared';
import type { TestServer, Client } from './harness.js';

export function standardTableDeck(id = 'td1'): TableDeck {
  const suits = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  return {
    id,
    sourceDeckId: null,
    versionId: null,
    name: 'Standard',
    homeZoneId: '',
    defs: suits.flatMap((s) => ranks.map((r) => ({ id: `${r}${s[0]}`, name: `${r} of ${s}`, count: 1, metadata: { suit: s } }))),
  };
}

export function dupDeck(id = 'td1'): TableDeck {
  return {
    id,
    sourceDeckId: null,
    versionId: null,
    name: 'Monsters',
    homeZoneId: '',
    defs: [
      { id: 'gob', name: 'Goblin', count: 3, metadata: {} },
      { id: 'orc', name: 'Orc', count: 1, metadata: {} },
    ],
  };
}

/** Host creates a table, others join; deck loaded via a system action. */
export async function tableWith(srv: TestServer, host: Client, others: Client[], deck: TableDeck | null = standardTableDeck(), opts: any = {}) {
  const { tableId } = await host.req({ t: 'table.create', name: 'Test table', ...opts });
  await host.req({ t: 'table.join', tableId });
  for (const o of others) await o.req({ t: 'table.join', tableId, ...(opts.password ? { password: opts.password } : {}) });
  if (deck) srv.app.tables.get(tableId)!.apply({ type: 'loadDeck', deck }, null);
  await new Promise((r) => setTimeout(r, 50));
  return tableId as string;
}
