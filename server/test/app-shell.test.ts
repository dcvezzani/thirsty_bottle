import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// installable-app 1.1: inspect the generated service worker (run `npm run build` first)
describe('installable-app: service worker contents', () => {
  const sw = fs.readFileSync(path.resolve('client/dist/sw.js'), 'utf8');

  it('never activates a new version on its own: skipWaiting only on an explicit message the app never sends', () => {
    expect(sw).not.toMatch(/clientsClaim\(/);
    const calls = sw.match(/skipWaiting\(\)/g) ?? [];
    expect(calls.length).toBeLessThanOrEqual(1);
    if (calls.length) expect(sw).toMatch(/"SKIP_WAITING"===e\.data\.type&&self\.skipWaiting\(\)/);
    const src = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? src(path.join(dir, d.name)) : [path.join(dir, d.name)]));
    for (const f of src(path.resolve('client/src'))) {
      const s = fs.readFileSync(f, 'utf8');
      expect(s, f).not.toMatch(/SKIP_WAITING|updateSW\(|skipWaiting/);
    }
  });

  it('precaches only static files and never routes API or WebSocket requests to the cache', () => {
    const urls = [...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(3);
    for (const u of urls) expect(u, u).toMatch(/\.(html|js|css|png|svg|webmanifest)$/);
    expect(urls.some((u) => u.startsWith('api/') || u.startsWith('/api'))).toBe(false);
    expect(sw).toContain('denylist:[/^\\/api\\//,/^\\/ws/]');
  });
});
