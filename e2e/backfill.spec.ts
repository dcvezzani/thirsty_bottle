import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import fs from 'node:fs';
import { onboard, newPlayer, createTable, joinTable, PHONE } from './helpers';

test('player-recovery-code: copy the code, continue as the same player (same seat) in another browser; unknown codes refused', async ({
  browser,
}) => {
  const ctxA = await browser.newContext();
  await ctxA.grantPermissions(['clipboard-read', 'clipboard-write']);
  const a = await ctxA.newPage();
  await onboard(a, 'Alex');
  await createTable(a, 'Recovery table', { deck: 'builtin-standard-52' });
  await a.goto('/');
  await a.getByRole('button', { name: 'Player menu' }).click();
  await a.getByRole('button', { name: 'Copy recovery code' }).click();
  const code = await a.evaluate(() => navigator.clipboard.readText());
  expect(code).toBe(await a.evaluate(() => sessionStorage.getItem('vct.token')));

  // another browser: unknown code first, then the real one
  const ctxB = await browser.newContext();
  const b = await ctxB.newPage();
  await onboard(b, 'Someone');
  await b.getByRole('button', { name: 'Player menu' }).click();
  await b.getByRole('button', { name: 'Switch player' }).click();
  await b.getByText('Continue with a recovery code').click();
  let alerted = '';
  b.once('dialog', (d) => ((alerted = d.message()), d.dismiss()));
  await b.getByLabel('Recovery code').fill('not-a-real-code-0123456789');
  await b.getByRole('button', { name: 'Go' }).click();
  await expect.poll(() => alerted).toBe('Unknown recovery code');
  await expect(b.getByRole('heading', { name: "Who's playing?" })).toBeVisible();
  await b.getByLabel('Recovery code').fill(code);
  await b.getByRole('button', { name: 'Go' }).click();
  await expect(b.getByRole('button', { name: 'Player menu' })).toContainText('Alex');
  await expect(b.getByText("You're still at a table.")).toBeVisible();
  await b.getByRole('button', { name: 'Return to table' }).click();
  await expect(b.getByRole('heading', { name: 'Recovery table' })).toBeVisible();
  await Promise.all([ctxA.close(), ctxB.close()]);
});

test('profile-rename: renaming in the "You" sheet shows on other players’ seat markers and the lobby', async ({
  browser,
}) => {
  const { ctx: c1, page: alex } = await newPlayer(browser, 'Alex', PHONE);
  await createTable(alex, 'Rename e2e');
  const { ctx: c2, page: sam } = await newPlayer(browser, 'Sam', PHONE);
  await joinTable(sam, 'Rename e2e');
  await expect(alex.getByTestId('seat-Sam')).toBeVisible();
  await sam.goto('/');
  await sam.getByRole('button', { name: 'Player menu' }).click();
  await sam.getByLabel('Display name').fill('Samantha');
  await sam.getByRole('button', { name: 'Save' }).click();
  await expect(sam.getByText('Name updated')).toBeVisible();
  await expect(alex.getByTestId('seat-Samantha')).toBeVisible();
  const { ctx: c3, page: kim } = await newPlayer(browser, 'Kim', PHONE);
  await kim.getByRole('tab', { name: /Players/ }).click();
  await expect(kim.getByLabel('Online players')).toContainText('Samantha');
  await Promise.all([c1.close(), c2.close(), c3.close()]);
});

test('image-access-control: two tabs as different players each load only images they may see', async ({
  browser,
}) => {
  const ctx = await browser.newContext();
  const a = await ctx.newPage();
  await onboard(a, 'Alex');
  const png = await sharp({ create: { width: 200, height: 280, channels: 3, background: '#aa2244' } })
    .png()
    .toBuffer();
  const deckId = await a.evaluate(async (b64) => {
    const token = sessionStorage.getItem('vct.token')!;
    const fd = new FormData();
    fd.append(
      'file',
      new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: 'image/png' }),
      'a.png',
    );
    const img = await (
      await fetch('/api/images', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: fd })
    ).json();
    const h = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    const d = await (
      await fetch('/api/decks', { method: 'POST', headers: h, body: JSON.stringify({ name: 'Secret art' }) })
    ).json();
    await fetch(`/api/decks/${d.id}/save`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({
        content: {
          name: 'Secret art',
          propertyTemplate: [],
          cards: [{ id: 'c', name: 'Painted', count: 1, metadata: {}, frontImageId: img.id }],
        },
      }),
    });
    return d.id as string;
  }, png.toString('base64'));
  await a.goto(`/decks/${deckId}`);
  const img = a.locator('[data-testid="card-row"] img').first();
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((e) => (e as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const src = (await img.getAttribute('src'))!;

  // second tab in the same browser, a different player: the same image with its own key does not load
  const b = await ctx.newPage();
  await b.goto('/');
  await b.getByRole('button', { name: 'New player' }).click();
  await b.locator('#name').fill('Sam');
  await b.getByRole('button', { name: 'Enter the lobby' }).click();
  await expect(b.getByRole('button', { name: '+ New table' })).toBeVisible();
  const loaded = await b.evaluate(async (src) => {
    const me = await (
      await fetch('/api/me', { headers: { authorization: `Bearer ${sessionStorage.getItem('vct.token')}` } })
    ).json();
    const url = src.replace(/k=[^&]+/, `k=${encodeURIComponent(me.imageKey)}`);
    return new Promise<boolean>((res) => {
      const i = new Image();
      i.onload = () => res(true);
      i.onerror = () => res(false);
      i.src = url;
    });
  }, src);
  expect(loaded).toBe(false);
  // Alex's tab still loads it (its own key), even after Sam's tab exists
  await a.reload();
  await expect
    .poll(() =>
      a
        .locator('[data-testid="card-row"] img')
        .first()
        .evaluate((e) => (e as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await ctx.close();
});

test('installable-app: a newly deployed service worker waits; the open table page does not reload', async ({
  browser,
}) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await onboard(page, 'Alex');
  await createTable(page, 'SW update');
  await page.evaluate(() => navigator.serviceWorker.ready);
  // a returning visit: the page is now controlled by the installed service worker
  await page.reload();
  await expect(page.getByRole('heading', { name: 'SW update' })).toBeVisible();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.evaluate(() => ((window as any).__sentinel = 'still-here'));
  let navigations = 0;
  page.on('framenavigated', (f) => f === page.mainFrame() && navigations++);
  // simulate a deploy: the server now serves a changed service worker script
  const swFile = 'client/dist/sw.js';
  const original = fs.readFileSync(swFile, 'utf8');
  fs.writeFileSync(swFile, original + '\n// new deploy\n');
  try {
    const state = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg!.update();
      const w = reg!.installing ?? reg!.waiting;
      if (w && w.state !== 'installed')
        await new Promise<void>((r) =>
          w.addEventListener('statechange', () => w.state === 'installed' && r()),
        );
      await new Promise((r) => setTimeout(r, 500));
      return { waiting: !!reg!.waiting, controller: navigator.serviceWorker.controller?.scriptURL ?? null };
    });
    expect(state.waiting).toBe(true);
    expect(await page.evaluate(() => (window as any).__sentinel)).toBe('still-here');
    expect(navigations).toBe(0);
    await expect(page.getByRole('heading', { name: 'SW update' })).toBeVisible();
  } finally {
    fs.writeFileSync(swFile, original);
  }
  await ctx.close();
});
