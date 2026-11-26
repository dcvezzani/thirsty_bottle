import { test, expect } from '@playwright/test';
import { onboard, createTable, draw, PHONE } from './helpers';
import { stripCenters, settle } from './table-helpers';

test('a fanned hand moved onto a pile keeps the stack as seen: the uncovered card is the pile\'s top card (2.1)', async ({ browser }) => {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  await onboard(page, 'Alex');
  await createTable(page, `Stack ${Date.now() % 100000}`, { deck: 'builtin-standard-52' });
  await draw(page, 'Standard 52', 4);
  const hand = page.getByTestId('row-hand');
  await expect(hand.locator('.card')).toHaveCount(4);

  // the card nothing covers is the last one in the fan
  const labels = await hand.locator('.card').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  const uncovered = labels[3]!;
  const covered = labels[0]!;

  // select the whole hand, then move it onto the Discard pile
  for (let i = 0; i < 4; i++) {
    const pts = await stripCenters(page, 'row-hand');
    await page.mouse.click(pts[i].x, pts[i].y);
  }
  await expect(page.getByTestId('selection-count')).toHaveText('4 selected');
  await page.getByRole('toolbar', { name: 'Selected cards' }).getByRole('button', { name: 'Actions…' }).click();
  await page.getByRole('button', { name: 'Move to…' }).click();
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
  await page.mouse.move(2, 2);
  await settle(page);

  const top = page.locator('[data-testid="pile-Discard"] .pile-top');
  await expect(top).toHaveAttribute('aria-label', uncovered);
  // and it stays so after the server's answer has settled (no flicker into the old order)
  await page.waitForTimeout(600);
  await expect(top).toHaveAttribute('aria-label', uncovered);
  await expect(page.locator('section.zone[aria-label="Discard"]')).toContainText('4');

  // drawing the cards back off the pile returns the uncovered one first, the covered one last
  await page.getByTestId('pile-Discard').click();
  await page.getByRole('button', { name: 'Draw 1', exact: true }).click();
  await expect(hand.locator('.card')).toHaveCount(1);
  expect(await hand.locator('.card').first().getAttribute('aria-label')).toBe(uncovered);
  expect(covered).not.toBe(uncovered);
  await ctx.close();
});
