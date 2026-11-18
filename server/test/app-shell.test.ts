import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// installable-app 1.1: inspect the generated service worker (run `npm run build` first)
describe('installable-app: service worker contents', () => {
  const sw = fs.readFileSync(path.resolve('client/dist/sw.js'), 'utf8');

  it('activates a new version only on an explicit message, sent only from client/src/update.ts (app-update-prompt)', () => {
    expect(sw).not.toMatch(/clientsClaim\(/);
    const calls = sw.match(/skipWaiting\(\)/g) ?? [];
    expect(calls.length).toBeLessThanOrEqual(1);
    if (calls.length) expect(sw).toMatch(/"SKIP_WAITING"===e\.data\.type&&self\.skipWaiting\(\)/);
    const src = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? src(path.join(dir, d.name)) : [path.join(dir, d.name)]));
    const allowed = path.resolve('client/src/update.ts');
    const stub = path.resolve('client/src/test');
    for (const f of src(path.resolve('client/src'))) {
      if (f === allowed || f.startsWith(stub) || /\.test\.tsx?$/.test(f)) continue;
      const s = fs.readFileSync(f, 'utf8');
      expect(s, f).not.toMatch(/SKIP_WAITING|updateSW\(|skipWaiting|registerSW\(/);
    }
    expect(fs.readFileSync(allowed, 'utf8')).toMatch(/void updateSW\(true\)/);
  });

  it('precaches only static files and never routes API or WebSocket requests to the cache', () => {
    const urls = [...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(3);
    for (const u of urls) expect(u, u).toMatch(/\.(html|js|css|png|svg|webmanifest)$/);
    expect(urls.some((u) => u.startsWith('api/') || u.startsWith('/api'))).toBe(false);
    expect(sw).toContain('denylist:[/^\\/api\\//,/^\\/ws/]');
  });
});
