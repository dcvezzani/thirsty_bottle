import { test, expect, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PHONE } from './helpers';
import { stripCenters, settle } from './table-helpers';

const PORT = 3300;
const BASE = `http://localhost:${PORT}`;
const DATA = path.resolve('.e2e-data-restart');

function startServer(keep: boolean): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['e2e/start-server.mjs'], {
      env: { ...process.env, PORT: String(PORT), E2E_DATA_DIR: DATA, ...(keep ? { E2E_KEEP_DATA: '1' } : {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    p.stdout!.on('data', (d) => String(d).includes('listening') && resolve(p));
    p.on('exit', (c) => c && reject(new Error(`server exited ${c}`)));
  });
}

async function onboard(page: Page, name: string) {
  await page.goto(BASE + '/');
  await page.locator('#name').fill(name);
  await page.getByRole('button', { name: 'Enter the lobby' }).click();
  await expect(page.getByRole('button', { name: '+ New table' })).toBeVisible();
}

async function view(page: Page) {
  await settle(page);
  return page.evaluate(() => ({
    hand: [...document.querySelectorAll<HTMLElement>('[data-testid="row-hand"] [data-h]')].map((e) => e.getAttribute('aria-label')),
    table: [...document.querySelectorAll<HTMLElement>('[data-testid="row-Table"] [data-h]')].map((e) => e.getAttribute('aria-label')),
    discard: document.querySelector('[data-testid="pile-Discard"] .pile-count')?.textContent,
    deck: document.querySelector('[data-testid="pile-Standard 52"] .pile-count')?.textContent,
    seats: [...document.querySelectorAll<HTMLElement>('.seat')].map((s) => s.getAttribute('aria-label')),
    mode: document.querySelector('[data-testid="mode-chip"]')?.textContent,
    counters: [...document.querySelectorAll<HTMLElement>('[data-testid^="counter-"]')].map((c) => c.textContent),
  }));
}

test('kill and restart the server mid-game: every client reconnects to identical state (10.4)', async ({ browser }) => {
  test.setTimeout(120_000);
  fs.rmSync(DATA, { recursive: true, force: true });
  let server = await startServer(false);
  try {
    const names = ['Alex', 'Sam', 'Kim', 'Lee'];
    const ctxs = await Promise.all(names.map(() => browser.newContext({ ...PHONE, baseURL: BASE })));
    const pages = await Promise.all(ctxs.map((c) => c.newPage()));
    for (let i = 0; i < 4; i++) await onboard(pages[i], names[i]);
    const [alex] = pages;
    await alex.getByRole('button', { name: '+ New table' }).click();
    await alex.locator('#tname').fill('Crash test');
    await alex.locator('#tdeck').selectOption('builtin-standard-52');
    await alex.getByRole('button', { name: 'Create and sit down' }).click();
    await expect(alex.getByRole('button', { name: 'Table settings' })).toBeVisible();
    for (const p of pages.slice(1)) {
      await p.getByTestId('table-row').filter({ hasText: 'Crash test' }).getByRole('button', { name: 'Join' }).click();
      await p.getByRole('button', { name: 'Take a seat' }).click();
      await expect(p.getByRole('button', { name: 'Table settings' })).toBeVisible();
    }
    // Hearts-like start: shuffle, deal 13, everyone plays a card, Alex scores, turn mode on
    await alex.getByTestId('pile-Standard 52').click();
    await alex.getByRole('button', { name: 'Shuffle' }).click();
    await alex.getByTestId('pile-Standard 52').click();
    await alex.getByRole('button', { name: 'Deal…' }).click();
    await alex.locator('#dealn').fill('13');
    await alex.getByRole('button', { name: 'Deal 13 to 4 seats' }).click();
    for (const p of pages) {
      await expect(p.getByTestId('row-hand').locator('[data-h]')).toHaveCount(13);
      const pts = await stripCenters(p, 'row-hand');
      await p.touchscreen.tap(pts[0].x, pts[0].y);
      await p.getByRole('button', { name: 'Actions…' }).click();
      await p.getByRole('button', { name: 'Play to Table' }).click();
    }
    await expect(alex.getByTestId('row-Table').locator('[data-h]')).toHaveCount(4);
    await alex.getByRole('button', { name: '+ Counter' }).click();
    await alex.getByLabel('New counter').fill('Alex score');
    await alex.getByRole('button', { name: 'Add', exact: true }).click();
    await alex.getByRole('button', { name: 'Increase Alex score' }).click();
    await alex.getByTestId('mode-chip').click();
    await expect(pages[3].getByTestId('turn-bar')).toHaveText(/Alex's turn/);
    const before = [];
    for (const p of pages) before.push(await view(p));

    // crash
    server.kill('SIGKILL');
    for (const p of pages) await expect(p.getByText(/Connection lost/)).toBeVisible({ timeout: 10_000 });
    server = await startServer(true);

    // everyone reconnects on their own (backoff ≤ 10 s) to the same state
    for (const p of pages) await expect(p.getByText(/Connection lost|Connecting/)).toHaveCount(0, { timeout: 20_000 });
    for (let i = 0; i < 4; i++) {
      await expect.poll(async () => JSON.stringify(await view(pages[i])), { timeout: 10_000 }).toBe(JSON.stringify(before[i]));
    }
    // and play continues
    await pages[0].getByRole('button', { name: 'End turn' }).click();
    await expect(pages[1].getByTestId('turn-bar')).toHaveText(/Your turn/);
    await Promise.all(ctxs.map((c) => c.close()));
  } finally {
    server.kill('SIGKILL');
  }
});
