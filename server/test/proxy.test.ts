import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { startServer, newPlayer, type TestServer } from './harness.js';

let srv: TestServer;
beforeAll(async () => {
  srv = await startServer();
});
afterAll(async () => srv.stop());

describe('cloud-hosting: behind an HTTPS reverse proxy (1.1)', () => {
  it('a JSON deck export requested through a TLS proxy uses https image URLs', async () => {
    const res = await fetch(`${srv.url}/api/decks/builtin-standard-52/export?format=json`, {
      headers: { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'thirsty-bottle.fly.dev' },
    });
    expect(res.status).toBe(200);
    // the built-in deck has no artwork, so check with a deck that has an image
    const p = await newPlayer(srv, 'Proxy');
    const auth = { authorization: `Bearer ${p.token}` };
    const png = await sharp({ create: { width: 50, height: 70, channels: 3, background: '#336699' } }).png().toBuffer();
    const fd = new FormData();
    fd.append('file', new Blob([png], { type: 'image/png' }), 'x.png');
    const img = await (await fetch(`${srv.url}/api/images`, { method: 'POST', headers: auth, body: fd })).json();
    const d = await (
      await fetch(`${srv.url}/api/decks`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Proxied' }) })
    ).json();
    await fetch(`${srv.url}/api/decks/${d.id}/save`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ content: { name: 'Proxied', propertyTemplate: [], cards: [{ id: 'c', name: 'C', count: 1, metadata: {}, frontImageId: img.id }] } }),
    });
    const viaProxy = await (
      await fetch(`${srv.url}/api/decks/${d.id}/export?format=json`, {
        headers: { ...auth, 'x-forwarded-proto': 'https', 'x-forwarded-host': 'thirsty-bottle.fly.dev' },
      })
    ).json();
    expect(viaProxy.cards[0].front).toMatch(/^https:\/\/thirsty-bottle\.fly\.dev\/api\/images\//);
    // without a proxy (local use) URLs stay plain http on the local host
    const direct = await (await fetch(`${srv.url}/api/decks/${d.id}/export?format=json`, { headers: auth })).json();
    expect(direct.cards[0].front).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/api\/images\//);
  });
});

describe('cloud-hosting: deployed version in /api/health (1.2)', () => {
  it('reports GIT_SHA when set, dev otherwise', async () => {
    const before = process.env.GIT_SHA;
    try {
      delete process.env.GIT_SHA;
      expect(await (await fetch(`${srv.url}/api/health`)).json()).toEqual({ ok: true, version: 'dev' });
      process.env.GIT_SHA = 'abc123def';
      expect(await (await fetch(`${srv.url}/api/health`)).json()).toEqual({ ok: true, version: 'abc123def' });
    } finally {
      if (before === undefined) delete process.env.GIT_SHA;
      else process.env.GIT_SHA = before;
    }
  });
});
