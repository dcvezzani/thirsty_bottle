// Marks a task in the OpenSpec tasks.md as done: node scripts/mark-task.mjs 1.1 [1.2 ...]
import fs from 'node:fs';
const file = 'openspec/changes/archive/2026-11-17-virtual-card-table/tasks.md';
let s = fs.readFileSync(file, 'utf8');
for (const id of process.argv.slice(2)) {
  const re = new RegExp(`^- \\[ \\] ${id.replace('.', '\\.')} `, 'm');
  if (!re.test(s)) { console.error('not found / already done:', id); process.exitCode = 1; continue; }
  s = s.replace(re, `- [x] ${id} `);
}
fs.writeFileSync(file, s);
