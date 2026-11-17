import { test, expect } from '@playwright/test';
import { onboard, createTable, draw, handCards, PHONE } from './helpers';

test('two tabs in one browser are different players at one table; reload and offline keep identities', async ({ browser }) => {
  const ctx = await browser.newContext(PHONE);
  // Network-drop simulation: Chromium's offline emulation does not cut open WebSockets, so route them.
  let offline = false;
  const live: { close(): Promise<void> }[] = [];
  await ctx.routeWebSocket(/\/ws$/, (ws) => {
    if (offline) return void ws.close();
    ws.connectToServer();
    live.push(ws);
  });
  const alex = await ctx.newPage();
  await onboard(alex, 'Alex');
  await createTable(alex, 'Debug table', { deck: 'builtin-standard-52' });

  // second tab in the same browser: the picker offers Alex, but we create Sam
  const sam = await ctx.newPage();
  await sam.goto('/');
  await expect(sam.getByRole('button', { name: 'Continue as Alex' })).toBeVisible();
  await onboard(sam, 'Sam');
  await sam.getByTestId('table-row').filter({ hasText: 'Debug table' }).getByRole('button', { name: 'Join' }).click();
  await sam.getByRole('button', { name: 'Take a seat' }).click();
  await expect(sam.getByTestId('seat-Alex')).toBeVisible();
  await expect(alex.getByTestId('seat-Sam')).toBeVisible();

  await draw(alex, 'Standard 52', 3);
  await draw(sam, 'Standard 52', 2);
  await expect(handCards(alex)).toHaveCount(3);
  await expect(handCards(sam)).toHaveCount(2);
  // each sees only their own hand: Sam's view of Alex is a count
  await expect(sam.getByTestId('seat-Alex')).toContainText('3');
  await expect(sam.getByTestId('seat-Alex').locator('[data-h]')).toHaveCount(0);

  // reload keeps each tab's identity and seat
  await alex.reload();
  await expect(handCards(alex)).toHaveCount(3);
  await expect(alex.getByTestId('seat-Sam')).toBeVisible();

  // network drop: both reconnect to their own seats
  await ctx.setOffline(true);
  offline = true;
  for (const ws of live.splice(0)) await ws.close();
  await expect(alex.getByText('Connection lost: reconnecting…')).toBeVisible({ timeout: 5_000 });
  await expect(sam.getByText('Connection lost: reconnecting…')).toBeVisible({ timeout: 5_000 });
  await alex.waitForTimeout(2000);
  offline = false;
  await ctx.setOffline(false);
  await expect(alex.getByText(/reconnecting|Connecting/)).toHaveCount(0, { timeout: 20_000 });
  await expect(sam.getByText(/reconnecting|Connecting/)).toHaveCount(0, { timeout: 20_000 });
  await expect(handCards(alex)).toHaveCount(3);
  await expect(handCards(sam)).toHaveCount(2);
  await expect(alex.getByTestId('seat-Sam')).toContainText('2');
  await ctx.close();
});

test('a duplicated tab does not silently share the player; continuing as the same player takes over', async ({ browser }) => {
  const ctx = await browser.newContext();
  const a = await ctx.newPage();
  await onboard(a, 'Alex');
  const token = await a.evaluate(() => sessionStorage.getItem('vct.token'));
  // simulate "Duplicate tab": the copy starts with the same sessionStorage
  const dup = await ctx.newPage();
  await dup.addInitScript((t) => sessionStorage.setItem('vct.token', t as string), token);
  await dup.goto('/');
  await expect(dup.getByText('That player is already open in another window')).toBeVisible();
  // deliberately continue as Alex: the newer window wins, the old one shows a notice
  await dup.getByRole('button', { name: 'Continue as Alex' }).click();
  await expect(dup.getByRole('button', { name: '+ New table' })).toBeVisible();
  await expect(a.getByText('Alex is open in another window')).toBeVisible();
  await a.getByRole('button', { name: 'Take it back' }).click();
  await expect(dup.getByText('Alex is open in another window')).toBeVisible();
  await ctx.close();
});

test('?newPlayer opens onboarding directly', async ({ browser }) => {
  const ctx = await browser.newContext();
  const a = await ctx.newPage();
  await onboard(a, 'Alex');
  await a.goto('/?newPlayer');
  await expect(a.locator('#name')).toBeVisible();
  await ctx.close();
});

test('the app is installable as a PWA', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/');
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== undefined && navigator.serviceWorker.ready.then(() => true));
  await page.evaluate(() => navigator.serviceWorker.ready);
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ name: 'Card Table', display: 'standalone' });
  const cdp = await ctx.newCDPSession(page);
  const { installabilityErrors } = (await cdp.send('Page.getInstallabilityErrors')) as any;
  expect(installabilityErrors).toEqual([]);
  await ctx.close();
});
