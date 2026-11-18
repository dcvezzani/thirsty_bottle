import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { onboard, createTable, draw } from './helpers';

// app-update-prompt 3.1: a simulated deploy changes the served service worker script
const SW = 'client/dist/sw.js';
let original = '';
test.beforeEach(() => {
  original = fs.readFileSync(SW, 'utf8');
});
test.afterEach(() => {
  fs.writeFileSync(SW, original);
});

/** Make the page controlled by the installed worker, so the next worker has to wait. */
async function controlled(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
}

async function deploy(page: Page) {
  fs.writeFileSync(SW, original + `\n// deploy ${Date.now()}\n`);
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg!.update();
  });
}

const mark = (page: Page) => page.evaluate(() => ((window as any).__sentinel = 'old-page'));
const sentinel = (page: Page) =>
  page.evaluate(() => (window as any).__sentinel ?? null).catch(() => 'navigating'); // mid-reload
const waitingWorker = (page: Page) =>
  page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting);
const handNames = (page: Page) =>
  page.getByTestId('row-hand').locator('[data-h]').evaluateAll((e) => e.map((x) => x.getAttribute('aria-label')));

test('at a table: the notice appears without a reload; Reload returns to the same table and hand on the new version', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await onboard(page, 'Alex');
  await createTable(page, 'Update table', { deck: 'builtin-standard-52' });
  await controlled(page);
  await draw(page, 'Standard 52', 4);
  await expect(page.getByTestId('row-hand').locator('[data-h]')).toHaveCount(4);
  const hand = await handNames(page);
  const url = page.url();
  await mark(page);
  let navigations = 0;
  page.on('framenavigated', (f) => f === page.mainFrame() && navigations++);
  await deploy(page);
  const notice = page.getByRole('status').filter({ hasText: 'A new version is available' });
  await expect(notice).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(2500); // longer than the idle-lobby check interval: still no reload at a table
  expect(navigations).toBe(0);
  expect(await sentinel(page)).toBe('old-page');
  await notice.getByRole('button', { name: 'Reload' }).click();
  await expect.poll(() => sentinel(page)).toBeNull();
  expect(page.url()).toBe(url);
  await expect(page.getByTestId('row-hand').locator('[data-h]')).toHaveCount(4);
  expect(await handNames(page)).toEqual(hand);
  expect(await waitingWorker(page)).toBe(false);
  await expect(notice).toHaveCount(0);
  await ctx.close();
});

test('in the lobby: a busy dialog waits, and closing it applies the update automatically', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await onboard(page, 'Alex');
  await controlled(page);
  await page.getByRole('button', { name: '+ New table' }).click();
  await page.locator('#tname').fill('Half typed');
  await mark(page);
  await deploy(page);
  await expect(page.getByRole('status').filter({ hasText: 'A new version is available' })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(2500);
  expect(await sentinel(page)).toBe('old-page');
  await expect(page.locator('#tname')).toHaveValue('Half typed');
  await page.keyboard.press('Escape');
  await expect.poll(() => sentinel(page), { timeout: 10_000 }).toBeNull();
  await expect(page.getByRole('button', { name: '+ New table' })).toBeVisible();
  expect(await waitingWorker(page)).toBe(false);
  await ctx.close();
});

test('leaving a table for the lobby applies a waiting update', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await onboard(page, 'Alex');
  await createTable(page, 'Update leave');
  await controlled(page);
  await mark(page);
  await deploy(page);
  await expect(page.getByRole('status').filter({ hasText: 'A new version is available' })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Back to lobby' }).click();
  await expect.poll(() => sentinel(page), { timeout: 10_000 }).toBeNull();
  await expect(page).toHaveURL(/\/$/);
  expect(await waitingWorker(page)).toBe(false);
  await ctx.close();
});
