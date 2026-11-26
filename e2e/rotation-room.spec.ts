import { test, expect, type Page } from '@playwright/test';
import { onboard, createTable, draw, PHONE } from './helpers';
import { stripCenters, settle } from './table-helpers';

async function start(browser: any, name: string) {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  await onboard(page, 'Alex');
  await createTable(page, `${name} ${Date.now() % 100000}`, { deck: 'builtin-standard-52' });
  await draw(page, 'Standard 52', 3);
  await expect(page.getByTestId('row-hand').locator('[data-h]')).toHaveCount(3);
  return { ctx, page };
}

const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Selected cards' });
async function selectHandCard(page: Page, i: number) {
  const pts = await stripCenters(page, 'row-hand');
  await page.mouse.click(pts[i].x, pts[i].y);
  await expect(page.getByTestId('selection-count')).toHaveText('1 selected');
}
const rotate = async (page: Page, steps: number) => {
  for (let k = 0; k < steps; k++) await toolbar(page).getByRole('button', { name: 'Rotate 45°' }).click();
};
const box = async (page: Page, sel: string, n = 0) => (await page.locator(sel).nth(n).boundingBox())!;

test('a rotated card is drawn at its normal size, its row makes room for it and gives it back, and its slot still selects it (1.1, 2.1)', async ({ browser }) => {
  const { ctx, page } = await start(browser, 'Room');
  await selectHandCard(page, 1);
  await page.mouse.move(2, 2); // the mouse hover would enlarge the card under it
  await settle(page);
  const row0 = await box(page, '[data-testid="row-hand"]');
  const slot = await box(page, '[data-testid="row-hand"] .card', 1);

  // 90°: drawn as large as an upright card, turned (its box is the slot's, swapped), and the row needs no extra height
  await rotate(page, 2);
  await expect(page.locator('[data-testid="row-hand"] .card-turn[data-rot="2"]')).toHaveCount(1);
  await settle(page);
  const t90 = await box(page, '[data-testid="row-hand"] .card-turn');
  expect(Math.abs(t90.width - slot.height)).toBeLessThan(3);
  expect(Math.abs(t90.height - slot.width)).toBeLessThan(3);
  const row90 = await box(page, '[data-testid="row-hand"]');
  expect(Math.abs(row90.height - row0.height)).toBeLessThan(2);

  // 135°: the row grows taller by the room the diagonal needs (about 0.3 card widths) and holds the whole card
  await rotate(page, 1);
  await expect(page.locator('[data-testid="row-hand"] .card-turn[data-rot="3"]')).toHaveCount(1);
  await settle(page);
  const row135 = await box(page, '[data-testid="row-hand"]');
  expect(row135.height - row0.height).toBeGreaterThan(slot.width * 0.25);
  expect(row135.height - row0.height).toBeLessThan(slot.width * 0.35);
  const t135 = await box(page, '[data-testid="row-hand"] .card-turn');
  expect(t135.y).toBeGreaterThanOrEqual(row135.y - 1);
  expect(t135.y + t135.height).toBeLessThanOrEqual(row135.y + row135.height + 1);
  expect(t135.width).toBeCloseTo(t135.height, 0); // a diagonal card's box is square

  // the slot is where it was: tapping its centre still selects it
  await page.getByRole('button', { name: 'Clear selection' }).click();
  await settle(page);
  const pts = await stripCenters(page, 'row-hand');
  await page.mouse.click(pts[1].x, pts[1].y);
  await expect(page.getByTestId('selection-count')).toHaveText('1 selected');

  // upright again: the row returns to its first size
  await toolbar(page).getByRole('button', { name: 'Actions…' }).click();
  await page.getByRole('button', { name: 'Upright', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid="row-hand"] .card-turn')).toHaveCount(0);
  await settle(page);
  const rowBack = await box(page, '[data-testid="row-hand"]');
  expect(Math.abs(rowBack.height - row0.height)).toBeLessThan(2);
  await ctx.close();
});

test('a column grows wider and a pile bigger for rotated cards, nothing is clipped or overflows the board, and both return to size (3.1)', async ({ browser }) => {
  const { ctx, page } = await start(browser, 'Room zones');
  await page.getByRole('button', { name: 'Table settings' }).click();
  await page.getByLabel('New zone name').fill('C');
  await page.getByLabel('New zone layout').selectOption('column');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('section.zone[aria-label="C"]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await page.getByTestId('pile-Standard 52').click();
  await page.getByRole('button', { name: 'Draw…' }).click();
  await page.locator('#dcount').fill('3');
  await page.locator('#dto').selectOption({ label: 'C' });
  await page.getByRole('button', { name: 'Draw 3' }).click();
  await expect(page.locator('section.zone[aria-label="C"] [data-h]')).toHaveCount(3);
  await settle(page);

  const zone = async (name: string) => (await page.locator(`section.zone[aria-label="${name}"]`).boundingBox())!;
  const noOverflow = () =>
    page.evaluate(() => {
      const b = document.querySelector('.board')!;
      return document.documentElement.scrollWidth <= innerWidth && b.scrollWidth <= b.clientWidth;
    });
  const colW0 = (await zone('C')).width;
  const pileW0 = (await zone('Standard 52')).width;
  const cardW = (await page.locator('section.zone[aria-label="C"] .card').first().boundingBox())!.width;

  // the column at 45°: wider by about 0.7 of a card width, and every turned card lies inside its zone
  await page.getByRole('button', { name: 'C actions' }).click();
  await page.getByRole('button', { name: 'Rotate all' }).click();
  await expect(page.locator('section.zone[aria-label="C"] .card-turn[data-rot="1"]')).toHaveCount(3);
  await settle(page);
  const colTurned = await zone('C');
  expect(colTurned.width - colW0).toBeGreaterThan(cardW * 0.5);
  for (let i = 0; i < 3; i++) {
    const t = (await page.locator('section.zone[aria-label="C"] .card-turn').nth(i).boundingBox())!;
    expect(t.x).toBeGreaterThanOrEqual(colTurned.x - 1);
    expect(t.x + t.width).toBeLessThanOrEqual(colTurned.x + colTurned.width + 1);
  }
  expect(await noOverflow()).toBe(true);

  // the pile (its top card turned): bigger
  await page.getByTestId('pile-Standard 52').click();
  await page.getByRole('button', { name: 'Rotate all' }).click();
  await settle(page);
  const pileTurned = await zone('Standard 52');
  expect(pileTurned.width).toBeGreaterThan(pileW0 + cardW * 0.5);
  expect(await noOverflow()).toBe(true);

  // upright again: both return to their first size
  for (const label of ['C actions', null] as const) {
    if (label) await page.getByRole('button', { name: label }).click();
    else await page.getByTestId('pile-Standard 52').click();
    await page.getByRole('button', { name: 'Upright all' }).click();
  }
  await expect(page.locator('.card-turn')).toHaveCount(0);
  await settle(page);
  expect(Math.abs((await zone('C')).width - colW0)).toBeLessThan(2);
  expect(Math.abs((await zone('Standard 52')).width - pileW0)).toBeLessThan(2);
  await ctx.close();
});
