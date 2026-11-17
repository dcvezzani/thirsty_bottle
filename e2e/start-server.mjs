// Starts the production server against a fresh temporary data directory for end-to-end tests.
import fs from 'node:fs';
import path from 'node:path';
const dir = path.resolve('.e2e-data');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
process.env.DATA_DIR = dir;
await import('../server/dist/main.js');
