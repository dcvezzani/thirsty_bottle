import { test, expect, type Page } from '@playwright/test';
import { newPlayer, createTable, joinTable, PHONE } from './helpers';
import { settle, expectToast } from './table-helpers';

// quick-flip e2e
let last = '';
const uniq = (n: string) => (last = `${n} ${Date.now() % 100000}`);

async function toTable(page: Page, n: number) {
  await page.getByTestId('pile-Standard 52').click();
  await page.getByRole('button', { name: 'Draw…' }).click();
  await page.locator('#dcount').fill(String(n));
  await page.locator('#dto').selectOption({ label: 'Table' });
  await page.getByRole('button', { name: `Draw ${n}` }).click();
  await expect(page.getByTestId('row-Table').locator('[data-h]')).toHaveCount(n);
  await settle(page);
  await page.waitForTimeout(150);
}
const card = (page: Page, i: number) => page.getByTestId('row-Table').locator('[data-h]').nth(i);
/** A point on card i's visible strip (cards overlap to the right). */
async function strip(page: Page, i: number) {
  const b = (await card(page, i).boundingBox())!;
  return { x: b.x + 8, y: b.y + b.height * 0.6 };
}
async function doubleTap(page: Page, p: { x: number; y: number }) {
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForTimeout(80);
  await page.touchscreen.tap(p.x, p.y);
}
const faces = (page: Page) => page.getByTestId('row-Table').locator('[data-h]').evaluateAll((e) => e.map((x) => (x.classList.contains('face') ? 'up' : 'down')));
async function logCount(page: Page) {
  await page.getByRole('button', { name: 'Log', exact: true }).click();
  const n = await page.getByLabel('Table log').locator('li').count();
  await page.getByRole('button', { name: 'Log', exact: true }).click();
  return n;
}

test('double tap flips one card; nothing stays selected; one log entry (2.1)', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex', PHONE);
  await createTable(page, uniq('Quick one'), { deck: 'builtin-standard-52' });
  await toTable(page, 5);
  const n0 = await logCount(page);
  await doubleTap(page, await strip(page, 1));
  await expect.poll(() => faces(page)).toEqual(['down', 'up', 'down', 'down', 'down']);
  await expect(page.locator('.card.selected')).toHaveCount(0);
  await expect(page.getByTestId('sel-count')).toHaveCount(0);
  expect(await logCount(page)).toBe(n0 + 1);
  await ctx.close();
});

test('double tap on a selected card flips the whole selection and clears it; outside the selection flips one (2.1)', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex', PHONE);
  await createTable(page, uniq('Quick sel'), { deck: 'builtin-standard-52' });
  await toTable(page, 6);
  // select cards 0, 1, 2 by tapping (waiting out the double-tap window between taps)
  for (const i of [0, 1, 2]) {
    const p = await strip(page, i);
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(400);
  }
  await expect(page.locator('.card.selected')).toHaveCount(3);
  const n0 = await logCount(page);
  await doubleTap(page, await strip(page, 1));
  await expect.poll(() => faces(page)).toEqual(['up', 'up', 'up', 'down', 'down', 'down']);
  await expect(page.locator('.card.selected')).toHaveCount(0);
  expect(await logCount(page)).toBe(n0 + 1); // one action
  // outside the selection: select 0 and 1, double-tap 4: only 4 flips, 0 and 1 stay selected
  for (const i of [0, 1]) {
    const p = await strip(page, i);
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(400);
  }
  await expect(page.locator('.card.selected')).toHaveCount(2);
  await doubleTap(page, await strip(page, 4));
  await expect.poll(() => faces(page)).toEqual(['up', 'up', 'up', 'down', 'up', 'down']);
  await expect(page.locator('.card.selected')).toHaveCount(2);
  await ctx.close();
});

test('double tap on a pile flips its top card without opening the sheet; a single tap still opens it (2.1)', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex', PHONE);
  await createTable(page, uniq('Quick pile'), { deck: 'builtin-standard-52' });
  const pile = page.getByTestId('pile-Standard 52');
  await expect(pile.locator('.pile-top')).toHaveClass(/back/);
  const b = (await pile.boundingBox())!;
  const p = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  await doubleTap(page, p);
  await expect(pile.locator('.pile-top')).toHaveClass(/face/);
  await page.waitForTimeout(500);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // single tap: the sheet opens after the short pause
  await page.touchscreen.tap(p.x, p.y);
  await expect(page.getByRole('dialog')).toBeVisible();
  await ctx.close();
});

test('selection bar Flip flips the selection in one action and clears it (2.2)', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex', PHONE);
  await createTable(page, uniq('Quick bar'), { deck: 'builtin-standard-52' });
  await toTable(page, 4);
  for (const i of [0, 1, 2]) {
    const p = await strip(page, i);
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(400);
  }
  const n0 = await logCount(page);
  await page.locator('.selection-bar').getByRole('button', { name: 'Flip', exact: true }).click();
  await expect.poll(() => faces(page)).toEqual(['up', 'up', 'up', 'down']);
  await expect(page.locator('.card.selected')).toHaveCount(0);
  expect(await logCount(page)).toBe(n0 + 1);
  await ctx.close();
});

test('mouse double-click flips a card on desktop (2.3)', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex', { viewport: { width: 1280, height: 800 } });
  await createTable(page, uniq('Quick mouse'), { deck: 'builtin-standard-52' });
  await toTable(page, 3);
  const p = await strip(page, 0);
  await page.mouse.dblclick(p.x, p.y);
  await expect.poll(() => faces(page)).toEqual(['up', 'down', 'down']);
  await expect(page.locator('.card.selected')).toHaveCount(0);
  await ctx.close();
});

test('out of turn, a double tap on a shared card is refused with the turn message (2.3)', async ({ browser }) => {
  const { ctx: c1, page: alex } = await newPlayer(browser, 'Alex', PHONE);
  await createTable(alex, uniq('Quick turn'), { deck: 'builtin-standard-52' });
  await toTable(alex, 3);
  const { ctx: c2, page: sam } = await newPlayer(browser, 'Sam', PHONE);
  await joinTable(sam, last);
  await alex.getByTestId('mode-chip').click();
  await expect(sam.getByTestId('turn-bar')).toHaveText(/Alex's turn/);
  await settle(sam);
  await doubleTap(sam, await strip(sam, 0));
  await expectToast(sam, "It's Alex's turn");
  await expect.poll(() => faces(sam)).toEqual(['down', 'down', 'down']);
  await expect.poll(() => faces(alex)).toEqual(['down', 'down', 'down']);
  await Promise.all([c1.close(), c2.close()]);
});
