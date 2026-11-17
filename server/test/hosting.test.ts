import { describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import WebSocket from 'ws';
import { Client, type TestServer } from './harness.js';

const MAIN = path.resolve('server/dist/main.js');

function freePort(): Promise<number> {
  return new Promise((res) => {
    const s = net.createServer().listen(0, () => {
      const p = (s.address() as net.AddressInfo).port;
      s.close(() => res(p));
    });
  });
}

function start(port: number, dataDir: string): Promise<{ proc: ChildProcess; out: string[] }> {
  return new Promise((resolve, reject) => {
    const out: string[] = [];
    const proc = spawn(process.execPath, [MAIN], { env: { ...process.env, PORT: String(port), DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'pipe'] });
    proc.stdout!.on('data', (d) => {
      out.push(...String(d).split('\n').filter(Boolean));
      if (out.some((l) => l.includes('Local:'))) setTimeout(() => resolve({ proc, out }), 100);
    });
    proc.on('exit', (c) => c && reject(new Error(`exited ${c}`)));
  });
}

const exitCode = (p: ChildProcess) => new Promise<number | null>((r) => p.on('exit', (c) => r(c)));

describe('server-hosting', () => {
  it('1.1 one port for app, API and WebSocket; prints local and network addresses; PORT and DATA_DIR', async () => {
    const port = await freePort();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vct-host-'));
    const { proc, out } = await start(port, dir);
    try {
      expect(out).toContain(`  Local:   http://localhost:${port}/`);
      const nets = Object.values(os.networkInterfaces())
        .flat()
        .filter((a) => a && a.family === 'IPv4' && !a.internal)
        .map((a) => `  Network: http://${a!.address}:${port}/`);
      for (const n of nets) expect(out).toContain(n);
      expect(out.filter((l) => l.includes('Network:'))).toHaveLength(nets.length);
      const html = await (await fetch(`http://127.0.0.1:${port}/`)).text();
      expect(html).toContain('<div id="root">');
      const deep = await fetch(`http://127.0.0.1:${port}/t/abc123`);
      expect(deep.headers.get('content-type')).toContain('text/html');
      expect((await fetch(`http://127.0.0.1:${port}/api/health`)).status).toBe(200);
      expect((await fetch(`http://127.0.0.1:${port}/api/nope`)).status).toBe(404);
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      await new Promise((r, j) => (ws.once('open', r), ws.once('error', j)));
      ws.close();
      expect(fs.existsSync(path.join(dir, 'cardtable.db'))).toBe(true);
      expect(fs.existsSync(path.join(dir, 'images'))).toBe(true);
      expect(fs.existsSync(path.join(dir, 'secret.key'))).toBe(true);
    } finally {
      proc.kill('SIGTERM');
      await exitCode(proc);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('1.2 SIGTERM mid-game exits 0 and a restart restores the table', async () => {
    const port = await freePort();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vct-host-'));
    let { proc } = await start(port, dir);
    const srv = { port, url: `http://127.0.0.1:${port}` } as TestServer;
    const a = await Client.connect(srv, 'Alex');
    const { tableId } = await a.req({ t: 'table.create', name: 'Shutdown', deckId: 'builtin-standard-52' });
    await a.req({ t: 'table.join', tableId });
    await a.act({ type: 'shuffle', zone: a.zone('Standard 52').id });
    await a.act({ type: 'draw', zone: a.zone('Standard 52').id, count: 5, from: 'top' });
    const hand = a.myHand().cards.map((c) => `${c.def}`);
    a.close();
    proc.kill('SIGTERM');
    expect(await exitCode(proc)).toBe(0);
    ({ proc } = await start(port, dir));
    try {
      const a2 = new Client(srv, a.token, a.id, 'Alex');
      await a2.open();
      await a2.req({ t: 'table.join', tableId });
      await new Promise((r) => setTimeout(r, 100));
      expect(a2.myHand().cards.map((c) => `${c.def}`)).toEqual(hand);
      expect(a2.zone('Standard 52').cards).toHaveLength(47);
      a2.close();
    } finally {
      proc.kill('SIGINT');
      expect(await exitCode(proc)).toBe(0);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('1.3 the dev server listens on all interfaces', () => {
    const cfg = fs.readFileSync(path.resolve('client/vite.config.ts'), 'utf8');
    expect(cfg).toMatch(/server:\s*\{\s*host:\s*true/);
  });
});
