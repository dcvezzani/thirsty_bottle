import { test, expect, type Page } from '@playwright/test';
import { newPlayer, createTable, PHONE } from './helpers';
import { settle } from './table-helpers';

// pile-flip e2e
const pile = (page: Page) => page.getByTestId('pile-Standard 52');
async function zoneAction(page: Page, name: string) {
  await pile(page).click();
  await page.waitForTimeout(350); // a pile opens its sheet after the double-tap window
  await page.getByRole('dialog').getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await settle(page);
}
const topLabel = (page: Page) => pile(page).locator('.pile-top').getAttribute('aria-label');
const topIsUp = (page: Page) => pile(page).locator('.pile-top').evaluate((e) => e.classList.contains('face'));
async function fanLabels(page: Page) {
  await pile(page).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Fan out' }).click();
  const labels = await page.getByRole('dialog').locator('[data-h]').evaluateAll((e) => e.map((x) => x.getAttribute('aria-label')));
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  return labels as string[];
}
async function peekTop(page: Page) {
  await pile(page).click();
  await page.waitForTimeout(350);
  await page.locator('#peekn').fill('1');
  await page.getByRole('button', { name: 'Peek', exact: true }).click();
  await page.getByRole('button', { name: 'Log', exact: true }).click();
  const t = await page.getByLabel('Table log').locator('li').first().innerText();
  await page.getByRole('button', { name: 'Log', exact: true }).click();
  return t.replace(/^.*You peeked at /, '').trim();
}
async function logCount(page: Page) {
  await page.getByRole('button', { name: 'Log', exact: true }).click();
  const n = await page.getByLabel('Table log').locator('li').count();
  await page.getByRole('button', { name: 'Log', exact: true }).click();
  return n;
}

test('Flip all turns a pile over: the former bottom card is on top, face up; a spread keeps its order (2.1)', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex', PHONE);
  await createTable(page, `Pile flip ${Date.now() % 100000}`, { deck: 'builtin-standard-52' });
  // learn the order: reveal in place, read the fan, then put it face down again
  await zoneAction(page, 'All face up');
  const order = await fanLabels(page);
  expect(order).toHaveLength(52);
  expect(await topLabel(page)).toBe(order[0]);
  await zoneAction(page, 'All face down');
  expect(await topIsUp(page)).toBe(false);
  // a spread keeps its order: draw the top 3 (face down) into Table, then Flip all there
  await pile(page).click();
  await page.waitForTimeout(350);
  await page.getByRole('button', { name: 'Draw…' }).click();
  await page.locator('#dcount').fill('3');
  await page.locator('#dto').selectOption({ label: 'Table' });
  await page.getByRole('button', { name: 'Draw 3' }).click();
  const row = page.getByTestId('row-Table').locator('[data-h]');
  await expect(row).toHaveCount(3);
  await page.getByRole('button', { name: 'Table actions' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Flip all', exact: true }).click();
  await settle(page);
  await expect.poll(() => row.evaluateAll((e) => e.map((x) => x.getAttribute('aria-label')))).toEqual(order.slice(0, 3));
  // turn the pile over: the former bottom card is now on top, face up
  await zoneAction(page, 'Flip all');
  expect(await topIsUp(page)).toBe(true);
  expect(await topLabel(page)).toBe(order[51]);
  expect(await fanLabels(page)).toEqual(order.slice(3).reverse());
  await ctx.close();
});

test('All face down squares up a mixed pile in place; All face up reveals it in place (3.1)', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex', PHONE);
  await createTable(page, `Pile faces ${Date.now() % 100000}`, { deck: 'builtin-standard-52' });
  // mixed pile: double-tap turns just the top card face up
  const b = (await pile(page).boundingBox())!;
  const c = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  await page.touchscreen.tap(c.x, c.y);
  await page.waitForTimeout(80);
  await page.touchscreen.tap(c.x, c.y);
  await expect.poll(() => topIsUp(page)).toBe(true);
  const top = await topLabel(page);
  const n0 = await logCount(page);
  await zoneAction(page, 'All face down');
  expect(await topIsUp(page)).toBe(false);
  expect(await logCount(page)).toBe(n0 + 1);
  expect(await peekTop(page)).toBe(top); // same card still on top
  // reveal in place
  await zoneAction(page, 'All face up');
  expect(await topIsUp(page)).toBe(true);
  expect(await topLabel(page)).toBe(top);
  await ctx.close();
});
