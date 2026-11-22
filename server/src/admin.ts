// Admin CLI: node server/dist/admin.js <reports|unhide <id>|hide <id>>   (uses DATA_DIR)
// Ids starting with "st_" or "builtin-setup-" are setups; anything else is a deck.
import path from 'node:path';
import { openDb } from './db.js';

const db = openDb(path.resolve(process.env.DATA_DIR ?? 'data'));
const [cmd, id] = process.argv.slice(2);
const isSetup = (x: string) => x.startsWith('st_') || x.startsWith('builtin-setup-');
if (cmd === 'reports') {
  const decks = db
    .prepare(
      `SELECT d.id, d.name, d.hidden, COUNT(r.reporter_id) AS reports, GROUP_CONCAT(r.reason, ' | ') AS reasons
       FROM deck_reports r JOIN decks d ON d.id = r.deck_id GROUP BY d.id ORDER BY reports DESC`,
    )
    .all();
  const setups = db
    .prepare(
      `SELECT s.id, s.name, s.hidden, COUNT(r.reporter_id) AS reports, GROUP_CONCAT(r.reason, ' | ') AS reasons
       FROM setup_reports r JOIN setups s ON s.id = r.setup_id GROUP BY s.id ORDER BY reports DESC`,
    )
    .all();
  console.log('Decks');
  console.table(decks);
  console.log('Setups');
  console.table(setups);
} else if ((cmd === 'unhide' || cmd === 'hide') && id) {
  const [table, reports, key] = isSetup(id) ? ['setups', 'setup_reports', 'setup_id'] : ['decks', 'deck_reports', 'deck_id'];
  db.prepare(`UPDATE ${table} SET hidden = ? WHERE id = ?`).run(cmd === 'hide' ? 1 : 0, id);
  if (cmd === 'unhide') db.prepare(`DELETE FROM ${reports} WHERE ${key} = ?`).run(id);
  console.log(`${cmd} ${id}: done`);
} else {
  console.log('usage: node server/dist/admin.js reports | unhide <id> | hide <id>');
  process.exitCode = 1;
}
