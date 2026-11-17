// Admin CLI: node server/dist/admin.js <reports|unhide <deckId>|hide <deckId>>   (uses DATA_DIR)
import path from 'node:path';
import { openDb } from './db.js';

const db = openDb(path.resolve(process.env.DATA_DIR ?? 'data'));
const [cmd, id] = process.argv.slice(2);
if (cmd === 'reports') {
  const rows = db
    .prepare(
      `SELECT d.id, d.name, d.hidden, COUNT(r.reporter_id) AS reports, GROUP_CONCAT(r.reason, ' | ') AS reasons
       FROM deck_reports r JOIN decks d ON d.id = r.deck_id GROUP BY d.id ORDER BY reports DESC`,
    )
    .all();
  console.table(rows);
} else if ((cmd === 'unhide' || cmd === 'hide') && id) {
  db.prepare('UPDATE decks SET hidden = ? WHERE id = ?').run(cmd === 'hide' ? 1 : 0, id);
  if (cmd === 'unhide') db.prepare('DELETE FROM deck_reports WHERE deck_id = ?').run(id);
  console.log(`${cmd} ${id}: done`);
} else {
  console.log('usage: node server/dist/admin.js reports | unhide <deckId> | hide <deckId>');
  process.exitCode = 1;
}
