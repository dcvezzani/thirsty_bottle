import { test, expect, type Page } from '@playwright/test';
import { onboard, createTable, draw, PHONE } from './helpers';
import { stripCenters, settle } from './table-helpers';

const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Selected cards' });
const hand = (page: Page) => page.getByTestId('row-hand');

async function tapHandCards(page: Page, idx: number[]) {
  for (const i of idx) {
    const pts = await stripCenters(page, 'row-hand');
    await page.mouse.click(pts[i].x, pts[i].y);
  }
  await expect(page.getByTestId('selection-count')).toHaveText(`${idx.length} selected`);
}
async function rotateSelection(page: Page, steps: number) {
  for (let k = 0; k < steps; k++) await toolbar(page).getByRole('button', { name: 'Rotate 45°' }).click();
}
async function moveSelectionToDiscard(page: Page) {
  await toolbar(page).getByRole('button', { name: 'Actions…' }).click();
  await page.getByRole('button', { name: 'Move to…' }).click();
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
  await settle(page);
}
const box = async (page: Page, sel: string) => (await page.locator(sel).first().boundingBox())!;

test('a pile with differently turned cards lines them up by their bottom-left corners (an L); one outline stays centred (2.1)', async ({ browser }) => {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  await onboard(page, 'Alex');
  await createTable(page, `Pile corner ${Date.now() % 100000}`, { deck: 'builtin-standard-52' });
  await draw(page, 'Standard 52', 6);
  await expect(hand(page).locator('[data-h]')).toHaveCount(6);
  const pile = '[data-testid="pile-Discard"]';
  const slot = () => box(page, pile);

  // a card turned 90° goes onto the pile first, then three upright cards on top of it
  await tapHandCards(page, [4]);
  await rotateSelection(page, 2);
  await expect.poll(() => hand(page).locator('.card-turn[data-rot="2"]').count()).toBe(1);
  await moveSelectionToDiscard(page);
  await page.mouse.move(2, 2);
  await settle(page);
  // alone, with one outline, the turned card is centred in the pile's slot
  const s1 = await slot();
  const lone = (await page.locator(`${pile} .pile-top .card-turn`).boundingBox())!;
  expect(Math.abs(lone.x + lone.width / 2 - (s1.x + s1.width / 2))).toBeLessThan(6);

  await tapHandCards(page, [0, 1, 2]);
  await moveSelectionToDiscard(page);
  await page.mouse.move(2, 2);
  await settle(page);

  // mixed: the upright top card and the card turned 90° beneath it share their bottom-left corner,
  // and the turned card sticks out on the right only
  const top = await box(page, `${pile} .pile-top`);
  const beneath = (await page.locator(`${pile} .pile-beneath .card-turn`).boundingBox())!;
  expect(Math.abs(beneath.x - top.x)).toBeLessThan(2.5); // left edges agree
  expect(Math.abs(beneath.y + beneath.height - (top.y + top.height))).toBeLessThan(2.5); // bottoms agree
  expect(beneath.x + beneath.width).toBeGreaterThan(top.x + top.width + 6); // sticks out on the right
  expect(beneath.y).toBeGreaterThanOrEqual(top.y - 1); // and not above
  // the pile's own box starts where the top card does: it grew on the right, not on the left or below
  const s2 = await slot();
  expect(Math.abs(s2.x - top.x)).toBeLessThan(2.5);
  expect(Math.abs(s2.y + s2.height - (top.y + top.height))).toBeLessThan(10);

  // tapping the part that sticks out acts like the pile
  await page.mouse.click(beneath.x + beneath.width - 4, beneath.y + beneath.height / 2);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');

  // a card turned 45° on top of them all: a mix of three outlines sharing the corner; the room is to the right and above
  await tapHandCards(page, [0]);
  await rotateSelection(page, 1);
  await expect.poll(() => hand(page).locator('.card-turn[data-rot="1"]').count()).toBe(1);
  await moveSelectionToDiscard(page);
  await page.mouse.move(2, 2);
  await settle(page);
  const diagTop = (await page.locator(`${pile} .pile-top .card-turn`).boundingBox())!;
  const landscape = (await page.locator(`${pile} .pile-beneath .card-turn[data-rot="2"]`).boundingBox())!;
  const upright = await box(page, `${pile} .pile-beneath:not(:has(.card-turn))`);
  for (const b of [diagTop, landscape, upright]) {
    expect(Math.abs(b.x - diagTop.x)).toBeLessThan(2.5); // left edges agree
    expect(Math.abs(b.y + b.height - (diagTop.y + diagTop.height))).toBeLessThan(2.5); // bottoms agree
  }
  expect(diagTop.width).toBeGreaterThan(upright.width + 6); // the diagonal card's outline sticks out to the right
  expect(diagTop.height).toBeGreaterThan(upright.height + 3); // and above: an L
  await ctx.close();
});

test('a pile whose cards all have one outline stays centred, and the room comes back when the mix ends (2.1)', async ({ browser }) => {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  await onboard(page, 'Alex');
  await createTable(page, `Pile one ${Date.now() % 100000}`, { deck: 'builtin-standard-52' });
  await page.getByTestId('pile-Standard 52').click();
  await page.getByRole('button', { name: 'Rotate all' }).click();
  await page.getByTestId('pile-Standard 52').click();
  await page.getByRole('button', { name: 'Rotate all' }).click(); // 90° for every card: one outline
  await settle(page);
  const slot = (await page.locator('[data-testid="pile-Standard 52"]').boundingBox())!;
  const top = (await page.locator('[data-testid="pile-Standard 52"] .pile-top .card-turn').boundingBox())!;
  expect(Math.abs(top.x + top.width / 2 - (slot.x + slot.width / 2))).toBeLessThan(8);
  expect(Math.abs(top.y + top.height / 2 - (slot.y + slot.height / 2))).toBeLessThan(10);
  await expect(page.locator('[data-testid="pile-Standard 52"] .pile-beneath')).toHaveCount(0);
  await ctx.close();
});
