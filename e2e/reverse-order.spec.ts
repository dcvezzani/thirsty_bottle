import { test, expect, type Page } from '@playwright/test';
import { onboard, createTable, draw, PHONE } from './helpers';
import { stripCenters, settle } from './table-helpers';

const labelsOf = (page: Page, testId: string) => page.getByTestId(testId).locator('.card').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));

test('Reverse order for a selection and for a zone; moves keep the cards\' order; reverse then move gives the other stacking (2.1)', async ({ browser }) => {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  await onboard(page, 'Alex');
  await createTable(page, `Reverse ${Date.now() % 100000}`, { deck: 'builtin-standard-52' });
  await draw(page, 'Standard 52', 4);
  const hand = page.getByTestId('row-hand');
  await expect(hand.locator('.card')).toHaveCount(4);
  const [A, B, C, D] = (await labelsOf(page, 'row-hand')) as string[];

  // select the whole hand and reverse it from the actions sheet: the hand reads D, C, B, A and the selection is kept
  for (let i = 0; i < 4; i++) {
    const pts = await stripCenters(page, 'row-hand');
    await page.mouse.click(pts[i].x, pts[i].y);
  }
  await expect(page.getByTestId('selection-count')).toHaveText('4 selected');
  const bar = page.getByRole('toolbar', { name: 'Selected cards' });
  await bar.getByRole('button', { name: 'Actions…' }).click();
  await page.getByRole('button', { name: 'Reverse order' }).click();
  await expect.poll(() => labelsOf(page, 'row-hand')).toEqual([D, C, B, A]);
  await expect(page.getByTestId('selection-count')).toHaveText('4 selected');

  // move it onto the Discard pile, as moves always do: the first card of the list (now D) is on top
  await page.getByRole('button', { name: 'Move to…' }).click();
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
  await page.mouse.move(2, 2);
  await settle(page);
  const top = page.locator('[data-testid="pile-Discard"] .pile-top');
  await expect(top).toHaveAttribute('aria-label', D); // the card nothing covered in the hand is on top
  await page.waitForTimeout(500);
  await expect(top).toHaveAttribute('aria-label', D);

  // a zone's sheet reverses every card in it: the pile is now A on top, faces unchanged
  await page.getByTestId('pile-Discard').click();
  await page.getByRole('button', { name: 'Reverse order' }).click();
  await settle(page);
  await expect(top).toHaveAttribute('aria-label', A);
  await expect(page.locator('.card-turn')).toHaveCount(0);

  // moves keep order without any reversing: draw the pile back to the hand one by one, A first
  await page.getByTestId('pile-Discard').click();
  await page.getByRole('button', { name: 'Draw 1', exact: true }).click();
  await expect(hand.locator('.card')).toHaveCount(1);
  expect(await hand.locator('.card').first().getAttribute('aria-label')).toBe(A);
  await ctx.close();
});

test('moving a fanned hand onto a pile keeps its order: the first card is on top (2.1)', async ({ browser }) => {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  await onboard(page, 'Alex');
  await createTable(page, `Keep order ${Date.now() % 100000}`, { deck: 'builtin-standard-52' });
  await draw(page, 'Standard 52', 4);
  const [A] = (await labelsOf(page, 'row-hand')) as string[];
  for (let i = 0; i < 4; i++) {
    const pts = await stripCenters(page, 'row-hand');
    await page.mouse.click(pts[i].x, pts[i].y);
  }
  await page.getByRole('toolbar', { name: 'Selected cards' }).getByRole('button', { name: 'Actions…' }).click();
  await page.getByRole('button', { name: 'Move to…' }).click();
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
  await page.mouse.move(2, 2);
  await settle(page);
  await expect(page.locator('[data-testid="pile-Discard"] .pile-top')).toHaveAttribute('aria-label', A);
  await ctx.close();
});
