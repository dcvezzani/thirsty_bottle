import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { startServer, api, newPlayer } from './harness.js';

const ADMIN = path.resolve('server/dist/admin.js');
const run = (dataDir: string, ...args: string[]) => execFileSync(process.execPath, [ADMIN, ...args], { env: { ...process.env, DATA_DIR: dataDir }, encoding: 'utf8' });

describe('deck-reporting 1.2: admin CLI', () => {
  it('lists reports, unhides (clearing reports) and hides decks', async () => {
    let srv = await startServer();
    const alex = await newPlayer(srv, 'Alex');
    const sam = await newPlayer(srv, 'Sam');
    const d = (await api(srv, 'POST', '/api/decks', { name: 'Gallery deck' }, alex.token)).data;
    await api(srv, 'PUT', `/api/decks/${d.id}/visibility`, { visibility: 'public' }, alex.token);
    await api(srv, 'POST', `/api/decks/${d.id}/report`, { reason: 'looks like spam' }, sam.token);
    const dir = srv.dataDir;
    await srv.stop(true);

    const listed = run(dir, 'reports');
    expect(listed).toContain(d.id);
    expect(listed).toContain('Gallery deck');
    expect(listed).toContain('looks like spam');
    expect(run(dir, 'unhide', d.id)).toContain(`unhide ${d.id}: done`);
    expect(run(dir, 'reports')).not.toContain(d.id);

    srv = await startServer({}, dir);
    expect((await api(srv, 'GET', '/api/gallery?q=Gallery', undefined, sam.token)).data.decks.map((x: any) => x.id)).toEqual([d.id]);
    await srv.stop(true);
    run(dir, 'hide', d.id);
    srv = await startServer({}, dir);
    expect((await api(srv, 'GET', '/api/gallery?q=Gallery', undefined, sam.token)).data.decks).toHaveLength(0);
    await srv.stop();
  });

  it('prints usage for unknown commands', () => {
    let out = '';
    try {
      run('/tmp/vct-admin-usage', 'nope');
    } catch (e: any) {
      out = String(e.stdout);
      expect(e.status).toBe(1);
    }
    expect(out).toMatch(/usage: node server\/dist\/admin\.js/);
  });
});
