import { test, expect, type Page } from '@playwright/test';
import { newPlayer, createTable, PHONE } from './helpers';
import { settle } from './table-helpers';

// stable-selection-bar e2e
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
const box = async (page: Page, sel: string) => (await page.locator(sel).first().boundingBox())!;
const layout = async (page: Page) => ({ board: await box(page, '.board'), row: await box(page, '[data-testid="row-Table"]'), hand: await box(page, '.hand-area') });

test('selecting never moves the board: same layout, double tap flips whether or not the card is selected', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex', PHONE);
  await createTable(page, `Stable ${Date.now() % 100000}`, { deck: 'builtin-standard-52' });
  await toTable(page, 5);
  const tabsH = (await box(page, '.drawer-tabs')).height;
  const before = await layout(page);

  // select a card: the toolbar takes the tabs' row, at the same height; nothing else moves
  const p0 = await strip(page, 0);
  await page.touchscreen.tap(p0.x, p0.y);
  await expect(page.getByRole('toolbar', { name: 'Selected cards' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Room', exact: true })).toHaveCount(0);
  expect((await box(page, '.selection-bar')).height).toBe(tabsH);
  expect(await layout(page)).toEqual(before);
  // nothing from the toolbar sits where the old bar did (the 150 px above the hand)
  const hand = before.hand;
  const stray = await page.evaluate(
    ({ y0, y1 }) => {
      let hits = 0;
      for (let y = y0; y < y1; y += 12) for (let x = 20; x < 360; x += 20) if (document.elementFromPoint(x, y)?.closest('.selection-bar')) hits++;
      return hits;
    },
    { y0: hand.y - 150, y1: hand.y },
  );
  expect(stray).toBe(0);

  // double tap an unselected card: only it flips, the selection stays, and the layout holds
  await doubleTap(page, await strip(page, 3));
  await expect.poll(() => faces(page)).toEqual(['down', 'down', 'down', 'up', 'down']);
  await expect(page.locator('.card.selected')).toHaveCount(1);
  expect(await layout(page)).toEqual(before);

  // double tap the selected card: the selection flips and clears, and the tabs return
  await doubleTap(page, await strip(page, 0));
  await expect.poll(() => faces(page)).toEqual(['up', 'down', 'down', 'up', 'down']);
  await expect(page.locator('.card.selected')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Room', exact: true })).toBeVisible();
  expect(await layout(page)).toEqual(before);

  // select, deselect by tapping the card again, select again: still no movement
  for (let i = 0; i < 3; i++) {
    await page.touchscreen.tap(p0.x, p0.y);
    await page.waitForTimeout(400);
    expect(await layout(page)).toEqual(before);
  }
  await ctx.close();
});

test('Actions has Select all, Clear and Face down; the toolbar tags face down; selecting closes the chat drawer', async ({ browser }) => {
  // a taller phone, so a card on the table stays reachable above the open drawer
  const { ctx, page } = await newPlayer(browser, 'Alex', { ...PHONE, viewport: { width: 375, height: 900 } });
  await createTable(page, `Stable toolbar ${Date.now() % 100000}`, { deck: 'builtin-standard-52' });
  await toTable(page, 5);

  // an open chat drawer closes when a selection starts (the tabs that would close it are replaced)
  await page.getByRole('button', { name: 'Room', exact: true }).click();
  await expect(page.getByRole('region', { name: 'room panel' })).toBeVisible();
  const p0 = await strip(page, 0);
  expect(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[data-testid="row-Table"]'), p0)).toBe(true); // the card is above the drawer
  await page.touchscreen.tap(p0.x, p0.y);
  await expect(page.getByTestId('selection-count')).toHaveText('1 selected');
  await expect(page.getByRole('region', { name: 'room panel' })).toHaveCount(0);

  // Select all, then the face down toggle, from the Actions sheet
  await page.getByRole('button', { name: 'Actions…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Select all' }).click();
  await expect(page.getByTestId('selection-count')).toHaveText('5 selected');
  await page.getByRole('button', { name: 'Actions…' }).click();
  await page.getByRole('dialog').getByLabel(/Face down/).check();
  await page.keyboard.press('Escape');
  await expect(page.locator('.face-down-tag')).toHaveText('face down');
  await page.getByRole('button', { name: 'Actions…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(page.getByTestId('selection-count')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Room', exact: true })).toBeVisible();
  await ctx.close();
});
