// Starts the production server against a temporary data directory for end-to-end tests.
// E2E_DATA_DIR picks the directory (default .e2e-data); E2E_KEEP_DATA=1 keeps existing data (restart tests).
import fs from 'node:fs';
import path from 'node:path';
const dir = path.resolve(process.env.E2E_DATA_DIR ?? '.e2e-data');
if (!process.env.E2E_KEEP_DATA) fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
process.env.DATA_DIR = dir;
await import('../server/dist/main.js');
