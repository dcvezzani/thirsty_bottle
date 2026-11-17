import path from 'node:path';
import { createApp } from './app.js';

const dataDir = path.resolve(process.env.DATA_DIR ?? 'data');
const port = Number(process.env.PORT ?? 3000);
const app = await createApp({ dataDir });
const actual = await app.listen(port);
console.log(`Card Table listening on http://localhost:${actual} (data: ${dataDir})`);

const stop = async () => {
  await app.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
