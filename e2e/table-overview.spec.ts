import { test, expect, type Page } from '@playwright/test';
import { newPlayer, createTable, joinTable, draw, PHONE } from './helpers';
import { stripCenters, touchPath, line } from './table-helpers';
import { lowContrast } from './contrast';

async function selectHandCard(page: Page, i: number) {
  const pts = await stripCenters(page, 'row-hand');
  await page.touchscreen.tap(pts[i].x, pts[i].y);
}
const faceUp = (page: Page, testId: string) => page.getByTestId(testId).locator('[data-h]').evaluateAll((els) => els.filter((e) => !/face-down/i.test(e.getAttribute('aria-label') ?? '')).length);
const total = (page: Page, testId: string) => page.getByTestId(testId).locator('[data-h]').count();

test('the overview lists everything public, hides hands and private cards, is read-only, live, and closes back to the table (3.1)', async ({ browser }) => {
  test.setTimeout(120_000);
  const { ctx: c1, page: alex } = await newPlayer(browser, 'Alex', PHONE);
  const name = `Overview ${Date.now() % 100000}`;
  await createTable(alex, name, { deck: 'builtin-standard-52' });
  const { ctx: c2, page: sam } = await newPlayer(browser, 'Sam', PHONE);
  await joinTable(sam, name);
  const { ctx: c3, page: kim } = await newPlayer(browser, 'Kim', PHONE);
  await joinTable(kim, name);
  await draw(alex, 'Standard 52', 4);
  await draw(sam, 'Standard 52', 2);
  await draw(kim, 'Standard 52', 1);

  // Alex shows one card to everyone and one only to Sam, and puts one on the Table face up
  await selectHandCard(alex, 0);
  await alex.getByRole('button', { name: 'Actions…' }).click();
  await alex.getByRole('button', { name: 'Show to…' }).click();
  await alex.getByRole('dialog').getByRole('button', { name: 'Everyone' }).click();
  await selectHandCard(alex, 1);
  await alex.getByRole('button', { name: 'Actions…' }).click();
  await alex.getByRole('button', { name: 'Show to…' }).click();
  await alex.getByRole('dialog').getByRole('button', { name: 'Sam', exact: true }).click();
  await selectHandCard(alex, 2);
  await alex.getByRole('button', { name: 'Actions…' }).click();
  await alex.getByRole('button', { name: 'Move to…' }).click();
  await alex.getByRole('dialog').getByRole('button', { name: 'Table', exact: true }).click();
  await expect(alex.getByTestId('row-Table').locator('[data-h]')).toHaveCount(1);

  // Kim keeps a card selected, opens the overview
  await selectHandCard(kim, 0);
  await expect(kim.getByTestId('selection-count')).toHaveText('1 selected');
  await kim.getByTestId('overview-btn').click();
  const ov = kim.getByTestId('overview');
  await expect(ov).toBeVisible();

  // sections in order: on the table, players, counters, notes
  const heads = await ov.locator('h3').allTextContents();
  expect(heads).toEqual(['On the table', 'Players', 'Counters', 'Notes']);
  await expect(ov.getByTestId('ov-zone-Table')).toBeVisible();
  await expect(ov.getByTestId('ov-pile-Standard 52')).toBeVisible();
  await expect(ov.getByTestId('ov-pile-Discard')).toContainText('0 cards');

  // hands are counts
  await expect(ov.getByTestId('ov-hand-Alex')).toContainText('3 in hand');
  await expect(ov.getByTestId('ov-hand-Sam')).toContainText('2 in hand');
  await expect(ov.getByTestId('ov-hand-Kim')).toContainText('1 in hand');
  // Alex's block: exactly the one card shown to everyone, not the one shown only to Sam
  expect(await total(kim, 'ov-shown-Alex')).toBe(1);
  expect(await faceUp(kim, 'ov-shown-Alex')).toBe(1);
  // the card on the Table is shown face up
  expect(await faceUp(kim, 'ov-row-Table')).toBe(1);

  // Sam was shown a second card privately, but the overview still shows only the public one
  await sam.getByTestId('overview-btn').click();
  expect(await total(sam, 'ov-shown-Alex')).toBe(1);

  // read-only: dragging a card in the overview moves nothing and sends no action
  const pts = await stripCenters(kim, 'ov-row-Table');
  await touchPath(kim, [pts[0], ...line(pts[0], { x: pts[0].x, y: pts[0].y - 120 })]);
  await expect(alex.getByTestId('row-Table').locator('[data-h]')).toHaveCount(1);
  await expect(kim.getByTestId('selection-count')).toHaveText('1 selected');

  // live: Alex discards a card; Kim's open overview shows the pile grow
  await selectHandCard(alex, 0);
  await alex.getByRole('button', { name: 'Actions…' }).click();
  await alex.getByRole('button', { name: 'Move to…' }).click();
  await alex.getByRole('dialog').getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(ov.getByTestId('ov-pile-Discard')).toContainText('1 card');

  // closing returns to the table with the selection kept
  await kim.getByRole('button', { name: 'Close overview' }).click();
  await expect(ov).toHaveCount(0);
  await expect(kim.getByTestId('selection-count')).toHaveText('1 selected');
  await c1.close();
  await c2.close();
  await c3.close();
});

test('a spectator can open the overview and sees the public table (3.1)', async ({ browser }) => {
  const { ctx: c1, page: alex } = await newPlayer(browser, 'Alex', PHONE);
  const name = `Overview watch ${Date.now() % 100000}`;
  await createTable(alex, name, { deck: 'builtin-standard-52' });
  await draw(alex, 'Standard 52', 3);
  const { ctx: c2, page: spec } = await newPlayer(browser, 'Wes', PHONE);
  await joinTable(spec, name, { spectate: true });
  await spec.getByTestId('overview-btn').click();
  const ov = spec.getByTestId('overview');
  await expect(ov.getByTestId('ov-hand-Alex')).toContainText('3 in hand');
  await expect(ov.getByTestId('ov-player-Alex')).toBeVisible();
  await c1.close();
  await c2.close();
});

for (const scheme of ['light', 'dark'] as const) {
  test(`the overview is readable in ${scheme} mode (3.1)`, async ({ browser }) => {
    const ctx = await browser.newContext({ ...PHONE, colorScheme: scheme });
    const page = await ctx.newPage();
    const { onboard } = await import('./helpers');
    await onboard(page, 'Alex');
    await createTable(page, `Overview ${scheme} ${Date.now() % 100000}`, { deck: 'builtin-standard-52' });
    await draw(page, 'Standard 52', 3);
    await page.getByRole('button', { name: '+ Counter' }).click();
    await page.getByLabel('New counter').fill('Score');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByTestId('overview-btn').click();
    await expect(page.getByTestId('overview')).toBeVisible();
    const issues = await lowContrast(page);
    expect(issues, issues.map((i) => `${i.kind} ${i.element} "${i.text}" ${i.ratio} < ${i.required}`).join('\n')).toEqual([]);
    await ctx.close();
  });
}
