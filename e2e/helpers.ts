import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

export const PHONE = { viewport: { width: 375, height: 740 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 };

/** Completes onboarding on a fresh page (or a page showing the identity picker). */
export async function onboard(page: Page, name: string) {
  await page.goto('/');
  const picker = page.getByRole('button', { name: 'New player' });
  const nameBox = page.locator('#name');
  await expect(picker.or(nameBox)).toBeVisible();
  if (await picker.isVisible()) await picker.click();
  await nameBox.fill(name);
  await page.getByRole('button', { name: 'Enter the lobby' }).click();
  await expect(page.getByRole('button', { name: '+ New table' })).toBeVisible();
}

export async function newPlayer(browser: Browser, name: string, opts: Parameters<Browser['newContext']>[0] = {}) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await onboard(page, name);
  return { ctx, page };
}

export async function createTable(page: Page, name: string, opts: { deck?: string; seats?: string; password?: string } = {}) {
  await page.getByRole('button', { name: '+ New table' }).click();
  await page.locator('#tname').fill(name);
  if (opts.seats) await page.locator('#tseats').selectOption(opts.seats);
  if (opts.password) await page.locator('#tpw').fill(opts.password);
  if (opts.deck) await page.locator('#tdeck').selectOption(opts.deck);
  await page.getByRole('button', { name: 'Create and sit down' }).click();
  await expect(page).toHaveURL(/\/t\//);
  await expect(page.getByRole('button', { name: 'Table settings' })).toBeVisible();
  return page.url().split('/t/')[1];
}

export async function joinTable(page: Page, tableName: string, opts: { password?: string; spectate?: boolean } = {}) {
  await page.goto('/');
  const row = page.getByTestId('table-row').filter({ hasText: tableName });
  await row.getByRole('button', { name: /Join|Open/ }).click();
  if (opts.password) await page.locator('#jpw').fill(opts.password);
  await page.getByRole('button', { name: opts.spectate ? 'Watch' : 'Take a seat' }).click();
  await expect(page.getByRole('button', { name: 'Table settings' })).toBeVisible();
}

/** Opens a pile's action sheet and draws n cards into my hand. */
export async function draw(page: Page, pile: string, n: number, from: 'top' | 'bottom' | 'random' = 'top') {
  await page.getByTestId(`pile-${pile}`).click();
  if (n === 1 && from === 'top') {
    await page.getByRole('button', { name: 'Draw 1', exact: true }).click();
    return;
  }
  await page.getByRole('button', { name: 'Draw…' }).click();
  await page.locator('#dcount').fill(String(n));
  await page.getByRole('button', { name: from, exact: true }).click();
  await page.getByRole('button', { name: `Draw ${n}` }).click();
}

export const handCards = (page: Page) => page.getByTestId('row-hand').locator('[data-h]');
export const rowCards = (page: Page, zone: string) => page.getByTestId(`row-${zone}`).locator('[data-h]');

export async function closeAll(...ctxs: BrowserContext[]) {
  for (const c of ctxs) await c.close();
}
