import { test, expect, type Page } from '@playwright/test';
import { newPlayer, createTable, PHONE } from './helpers';
import { settle } from './table-helpers';

// pile-move e2e
const deck = (page: Page) => page.getByTestId('pile-Standard 52');
const discard = (page: Page) => page.getByTestId('pile-Discard');
async function zoneAction(page: Page, pile: ReturnType<typeof deck>, name: string) {
  await pile.click();
  await page.getByRole('dialog').getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await settle(page);
}
async function fanLabels(page: Page, pile: ReturnType<typeof deck>) {
  await pile.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Fan out' }).click();
  const labels = await page.getByRole('dialog').locator('[data-h]').evaluateAll((e) => e.map((x) => x.getAttribute('aria-label')));
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  return labels as string[];
}
const pileCount = async (pile: ReturnType<typeof deck>) => Number(await pile.locator('.pile-count').innerText());
const center = async (l: ReturnType<typeof deck>) => {
  const b = (await l.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
async function touchDrag(page: Page, from: { x: number; y: number }, to: () => Promise<{ x: number; y: number }>, opts: { tapFirst?: boolean } = {}) {
  const cdp = await page.context().newCDPSession(page);
  const t = (type: string, p?: { x: number; y: number }) => cdp.send('Input.dispatchTouchEvent', { type: type as any, touchPoints: p ? [p] : [] });
  if (opts.tapFirst) {
    await t('touchStart', from);
    await page.waitForTimeout(40);
    await t('touchEnd');
    await page.waitForTimeout(80);
  }
  await t('touchStart', from);
  const end = await to();
  for (let i = 1; i <= 10; i++) {
    await page.waitForTimeout(20);
    await t('touchMove', { x: from.x + ((end.x - from.x) * i) / 10, y: from.y + ((end.y - from.y) * i) / 10 });
  }
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(40);
    await t('touchMove', await to());
  }
  await t('touchEnd');
}
async function logCount(page: Page) {
  await page.getByRole('button', { name: 'Log', exact: true }).click();
  const n = await page.getByLabel('Table log').locator('li').count();
  await page.getByRole('button', { name: 'Log', exact: true }).click();
  return n;
}

test('select a pile and drag it onto Discard: all cards on top in order, one log entry, one undo; a plain drag takes one card (2.1)', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex', PHONE);
  await createTable(page, `Pile move ${Date.now() % 100000}`, { deck: 'builtin-standard-52' });
  await zoneAction(page, deck(page), 'All face up');
  const order = await fanLabels(page, deck(page));
  // a plain drag of the (unselected) deck takes only the top card
  await touchDrag(page, await center(deck(page)), () => center(discard(page)));
  await expect.poll(() => pileCount(discard(page))).toBe(1);
  expect(await pileCount(deck(page))).toBe(51);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => pileCount(deck(page))).toBe(52);
  // select the whole deck (the log is counted first: the selection toolbar takes the tabs' row while selecting)
  const n0 = await logCount(page);
  await zoneAction(page, deck(page), 'Select all');
  await expect(deck(page).getByTestId('sel-count')).toHaveText('52');
  await expect(page.locator('.selection-bar')).toContainText('52');
  await touchDrag(page, await center(deck(page)), () => center(discard(page)));
  await expect.poll(() => pileCount(discard(page))).toBe(52);
  await expect(deck(page).locator('.pile-count')).toHaveText('0');
  expect(await fanLabels(page, discard(page))).toEqual(order);
  expect(await logCount(page)).toBe(n0 + 1);
  await expect(page.locator('.selection-bar')).toHaveCount(0);
  // one undo restores both piles
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => pileCount(deck(page))).toBe(52);
  expect(await pileCount(discard(page))).toBe(0);
  expect(await fanLabels(page, deck(page))).toEqual(order);
  await ctx.close();
});

test('tap, then drag moves the whole pile into a spread without opening the sheet; tap, tap still flips the top card (2.2)', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex', PHONE);
  await createTable(page, `Pile tapdrag ${Date.now() % 100000}`, { deck: 'builtin-standard-52' });
  // tap, tap: flips only the top card
  const c = await center(deck(page));
  await page.touchscreen.tap(c.x, c.y);
  await page.waitForTimeout(80);
  await page.touchscreen.tap(c.x, c.y);
  await expect(deck(page).locator('.pile-top')).toHaveClass(/face/);
  expect(await pileCount(deck(page))).toBe(52);
  await page.waitForTimeout(400);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // tap, then press-and-drag into the Table spread (an empty slim bar that opens under the cards)
  const table = page.locator('section.zone[aria-label="Table"]');
  await touchDrag(page, await center(deck(page)), () => center(table), { tapFirst: true });
  await expect(page.getByTestId('row-Table').locator('[data-h]')).toHaveCount(52);
  await expect(deck(page).locator('.pile-count')).toHaveText('0');
  await page.waitForTimeout(400);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await ctx.close();
});
