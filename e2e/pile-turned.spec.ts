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
async function moveSelectionToDiscard(page: Page) {
  await toolbar(page).getByRole('button', { name: 'Actions…' }).click();
  await page.getByRole('button', { name: 'Move to…' }).click();
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
  await settle(page);
}

test('a pile draws a differently turned card beneath its top card, as it really is; the pile still acts as one (1.1, 2.1)', async ({ browser }) => {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  await onboard(page, 'Alex');
  await createTable(page, `Pile turn ${Date.now() % 100000}`, { deck: 'builtin-standard-52' });
  await draw(page, 'Standard 52', 5);
  await expect(hand(page).locator('[data-h]')).toHaveCount(5);

  const pile = page.locator('[data-testid="pile-Discard"]');
  const zone = page.locator('section.zone[aria-label="Discard"]');
  const upright = (await page.locator('section.zone[aria-label="Standard 52"]').boundingBox())!.width;

  // build the Discard pile, top to bottom: three upright cards, then one turned 90°
  await tapHandCards(page, [3]);
  for (let k = 0; k < 2; k++) await toolbar(page).getByRole('button', { name: 'Rotate 45°' }).click();
  await expect.poll(() => hand(page).locator('.card-turn[data-rot="2"]').count()).toBe(1);
  await moveSelectionToDiscard(page); // the turned card is now the top (and only) card
  await tapHandCards(page, [0, 1, 2]);
  await moveSelectionToDiscard(page); // three upright cards go on top of it
  await expect(zone).toContainText('4');
  await page.mouse.move(2, 2);
  await settle(page);

  // the turned card is drawn beneath the top card, face up as it really is, sticking out at both sides
  await expect(pile.locator('.pile-beneath')).toHaveCount(1);
  await expect(pile.locator('.pile-beneath .card-turn[data-rot="2"]')).toHaveCount(1);
  const beneath = (await pile.locator('.pile-beneath .card-turn').boundingBox())!;
  const top = (await pile.locator('.pile-top').boundingBox())!;
  expect(beneath.x).toBeLessThan(top.x - 3);
  expect(beneath.x + beneath.width).toBeGreaterThan(top.x + top.width + 3);
  await expect(pile.locator('.pile-beneath.face')).toHaveCount(1); // its real face, not a generic back

  // decoration only: one card handle in the zone (the top card), and the pile grew to hold the turned card
  await expect(zone.locator('[data-h]')).toHaveCount(1);
  await expect(pile.locator('.pile-beneath[data-h]')).toHaveCount(0);
  expect((await zone.boundingBox())!.width).toBeGreaterThan(upright + 8);

  // tapping the part that sticks out acts like the top card: the pile's actions open
  await page.mouse.click(beneath.x + 3, beneath.y + beneath.height / 2);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');

  // a turned top card over an upright face-up card: the upright card shows above and below
  await tapHandCards(page, [0]);
  for (let k = 0; k < 2; k++) await toolbar(page).getByRole('button', { name: 'Rotate 45°' }).click();
  await expect.poll(() => hand(page).locator('.card-turn[data-rot="2"]').count()).toBe(1);
  await moveSelectionToDiscard(page);
  await page.mouse.move(2, 2);
  await settle(page);
  const beneathCards = pile.locator('.pile-beneath');
  await expect(beneathCards).toHaveCount(1);
  await expect(beneathCards.first()).toHaveClass(/face/);
  await expect(beneathCards.first().locator('.card-turn')).toHaveCount(0); // an upright card beneath the turned top card
  const up = (await beneathCards.first().boundingBox())!;
  const turnedTop = (await pile.locator('.pile-top .card-turn').boundingBox())!;
  expect(up.y).toBeLessThan(turnedTop.y - 3);
  expect(up.y + up.height).toBeGreaterThan(turnedTop.y + turnedTop.height + 3);
  await ctx.close();
});
