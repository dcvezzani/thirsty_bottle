import { test, expect, type Page } from '@playwright/test';
import { onboard, createTable, draw, PHONE } from './helpers';
import { stripCenters, settle } from './table-helpers';
import { lowContrast } from './contrast';

async function start(browser: any, name: string, mode: 'second-finger' | 'stay' = 'second-finger') {
  const ctx = await browser.newContext(PHONE);
  await ctx.addInitScript((m: string) => localStorage.setItem('vct.loupeMode', m), mode);
  const page = await ctx.newPage();
  await onboard(page, 'Alex');
  await createTable(page, `${name} ${Date.now() % 100000}`, { deck: 'builtin-standard-52' });
  await draw(page, 'Standard 52', 3);
  await expect(page.getByTestId('row-hand').locator('[data-h]')).toHaveCount(3);
  return { ctx, page };
}

/** The rotation drawn on each card in a zone, in order (0 = upright). */
const rots = (page: Page, testId: string) =>
  page.getByTestId(testId).locator('.card').evaluateAll((els) => els.map((e) => Number(e.querySelector(':scope > .card-turn')?.getAttribute('data-rot') ?? 0)));

async function selectHandCard(page: Page, i: number) {
  const pts = await stripCenters(page, 'row-hand');
  await page.mouse.click(pts[i].x, pts[i].y);
  await expect(page.getByTestId('selection-count')).toHaveText('1 selected');
}

test('rotate from the toolbar and the sheet: the slot does not change, the selection stays, a move keeps it, upright and gather reset it (3.1, 4.1)', async ({ browser }) => {
  const { ctx, page } = await start(browser, 'Turn');
  const slot = async () => (await page.getByTestId('row-hand').locator('.card').nth(1).boundingBox())!;
  const before = await slot();
  await selectHandCard(page, 1);

  // the toolbar still fits on one line with Rotate; each tap adds 45° and the selection is kept
  const bar = page.getByRole('toolbar', { name: 'Selected cards' });
  const box = (await bar.boundingBox())!;
  expect(box.height).toBeLessThan(60);
  expect(await bar.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
  await bar.getByRole('button', { name: 'Rotate 45°' }).click();
  await expect.poll(() => rots(page, 'row-hand')).toEqual([0, 1, 0]);
  await bar.getByRole('button', { name: 'Rotate 45°' }).click();
  await expect.poll(() => rots(page, 'row-hand')).toEqual([0, 2, 0]);
  await expect(page.getByTestId('selection-count')).toHaveText('1 selected');
  await page.mouse.move(2, 2); // the mouse hover would enlarge the card under it
  await settle(page);
  const after = await slot();
  expect(Math.abs(after.width - before.width)).toBeLessThan(1.5); // the slot never changes
  expect(Math.abs(after.height - before.height)).toBeLessThan(1.5);
  // a card turned 90° is drawn at its normal size, not scaled down: its box is the slot's, swapped
  const turned = (await page.getByTestId('row-hand').locator('.card-turn').first().boundingBox())!;
  expect(Math.abs(turned.width - after.height)).toBeLessThan(3);
  expect(Math.abs(turned.height - after.width)).toBeLessThan(3);

  // the sheet: back 45°, then upright
  await bar.getByRole('button', { name: 'Actions…' }).click();
  await page.getByRole('button', { name: /Rotate back 45/ }).click();
  await expect.poll(() => rots(page, 'row-hand')).toEqual([0, 1, 0]);
  await page.getByRole('button', { name: 'Upright', exact: true }).click();
  await expect.poll(() => rots(page, 'row-hand')).toEqual([0, 0, 0]);
  await page.keyboard.press('Escape');

  // rotate again, then play it to the Table: the rotation goes with it
  await bar.getByRole('button', { name: 'Rotate 45°' }).click();
  await expect.poll(() => rots(page, 'row-hand')).toEqual([0, 1, 0]);
  await bar.getByRole('button', { name: 'Actions…' }).click();
  await page.getByRole('button', { name: 'Move to…' }).click();
  await page.getByRole('button', { name: 'Table', exact: true }).click();
  await expect.poll(() => rots(page, 'row-Table')).toEqual([1]);

  // a zone's sheet: Rotate all, Upright all
  await page.getByRole('button', { name: 'Table actions' }).click();
  await page.getByRole('button', { name: 'Rotate all' }).click();
  await expect.poll(() => rots(page, 'row-Table')).toEqual([2]);
  await page.getByRole('button', { name: 'Table actions' }).click();
  await page.getByRole('button', { name: 'Upright all' }).click();
  await expect.poll(() => rots(page, 'row-Table')).toEqual([0]);

  // gather returns rotated cards upright
  await page.getByRole('button', { name: 'Table actions' }).click();
  await page.getByRole('button', { name: 'Rotate all' }).click();
  await expect.poll(() => rots(page, 'row-Table')).toEqual([1]);
  await page.getByTestId('pile-Standard 52').click();
  await page.getByRole('button', { name: 'Gather all here' }).click();
  await expect(page.getByTestId('row-Table').locator('[data-h]')).toHaveCount(0);
  await expect(page.locator('.card-turn')).toHaveCount(0);
  await ctx.close();
});

test('the loupe shows a rotated card upright in Card and Details and rotated in True full; the stay-open buttons rotate it (3.1, 4.1)', async ({ browser }) => {
  const { ctx, page } = await start(browser, 'Loupe turn', 'stay');
  await selectHandCard(page, 1);
  await page.getByRole('toolbar', { name: 'Selected cards' }).getByRole('button', { name: 'Rotate 45°' }).click();
  await page.getByRole('toolbar', { name: 'Selected cards' }).getByRole('button', { name: 'Rotate 45°' }).click();
  await expect.poll(() => rots(page, 'row-hand')).toEqual([0, 2, 0]);
  await page.getByRole('button', { name: 'Clear selection' }).click();

  // scrub to that card and lift: the loupe stays (stay open)
  const pts = await stripCenters(page, 'row-hand');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pts[0]] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: pts[0].x + 10, y: pts[0].y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pts[1]] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const loupe = page.getByTestId('loupe');
  await expect(loupe).toBeVisible();

  // Card: upright (no turned card in the loupe); Details: upright; True full: turned 90°
  await expect(loupe.locator('.card-turn')).toHaveCount(0);
  await loupe.getByRole('button', { name: 'Details' }).click();
  await expect(page.getByTestId('loupe-details')).toBeVisible();
  await expect(loupe.locator('.card-turn')).toHaveCount(0);
  await loupe.getByRole('button', { name: 'True full' }).click();
  await expect(page.getByTestId('loupe-true')).toBeVisible();
  await expect(loupe.locator('.card-turn')).toHaveAttribute('data-rot', '2');
  const sq = (await page.getByTestId('loupe-true').boundingBox())!;
  const t = (await loupe.locator('.card-turn').boundingBox())!;
  expect(t.width).toBeLessThanOrEqual(sq.width + 1);
  expect(t.height).toBeLessThanOrEqual(sq.height + 1);

  // the loupe's rotate buttons turn the card on the table
  await loupe.getByRole('button', { name: 'Rotate 45°' }).click();
  await expect.poll(() => rots(page, 'row-hand')).toEqual([0, 3, 0]);
  await expect(loupe.locator('.card-turn')).toHaveAttribute('data-rot', '3');
  await loupe.getByRole('button', { name: 'Rotate back 45°' }).click();
  await loupe.getByRole('button', { name: 'Rotate back 45°' }).click();
  await expect.poll(() => rots(page, 'row-hand')).toEqual([0, 1, 0]);
  await loupe.getByRole('button', { name: 'Card' }).click();
  await expect(loupe.locator('.card-turn')).toHaveCount(0);
  await ctx.close();
});

const center = (b: { x: number; y: number; width: number; height: number }) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

test('a second-finger swipe on the loupe rotates the card shown, a tap still switches the view, a slow drag does nothing (5.1)', async ({ browser }) => {
  const { ctx, page } = await start(browser, 'Swipe');
  const pts = await stripCenters(page, 'row-hand');
  const cdp = await page.context().newCDPSession(page);
  const f1 = (p: { x: number; y: number }) => ({ ...p, id: 1 });
  const touch = (type: string, points: { x: number; y: number; id: number }[]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  await touch('touchStart', [f1(pts[0])]);
  await touch('touchMove', [f1({ x: pts[0].x + 10, y: pts[0].y })]);
  await touch('touchMove', [f1(pts[1])]); // the scrub is on the middle card
  const loupe = page.getByTestId('loupe');
  await expect(loupe).toBeVisible();
  // let the holding finger's pause settle first (its details peek and zone pin land about 300 ms in), so the swipes do not race it
  await expect(page.getByTestId('loupe-details')).toBeVisible();
  const at = center((await loupe.boundingBox())!);

  const swipe = async (dx: number, ms = 80) => {
    await touch('touchStart', [f1(pts[1]), { ...at, id: 2 }]);
    await page.waitForTimeout(ms);
    await touch('touchMove', [f1(pts[1]), { x: at.x + dx, y: at.y + 2, id: 2 }]);
    await touch('touchEnd', [{ x: at.x + dx, y: at.y + 2, id: 2 }]);
  };
  await swipe(60); // right: clockwise
  await expect.poll(() => rots(page, 'row-hand')).toEqual([0, 1, 0]);
  await settle(page);
  await swipe(60);
  await expect.poll(() => rots(page, 'row-hand')).toEqual([0, 2, 0]);
  await settle(page);
  await swipe(-60); // left: back
  await expect.poll(() => rots(page, 'row-hand')).toEqual([0, 1, 0]);
  // a swipe is not a tap: no view was chosen (the holding finger's pause may peek at details, which is not a choice)
  expect(await page.evaluate(() => sessionStorage.getItem('vct.loupeFace'))).toBeNull();

  // a quick tap still switches the view and rotates nothing (the finger moves to another card first, ending the pause's peek)
  await touch('touchMove', [f1(pts[0])]);
  await touch('touchStart', [f1(pts[0]), { ...at, id: 2 }]);
  await page.waitForTimeout(60);
  await touch('touchEnd', [{ ...at, id: 2 }]);
  await expect(page.getByTestId('loupe-details')).toBeVisible();
  expect(await rots(page, 'row-hand')).toEqual([0, 1, 0]);
  expect(await page.evaluate(() => sessionStorage.getItem('vct.loupeFace'))).toBe('details');

  // a slow drag does nothing
  await touch('touchStart', [f1(pts[0]), { ...at, id: 2 }]);
  await page.waitForTimeout(700);
  await touch('touchMove', [f1(pts[0]), { x: at.x + 70, y: at.y, id: 2 }]);
  await touch('touchEnd', [{ x: at.x + 70, y: at.y, id: 2 }]);
  await page.waitForTimeout(200);
  expect(await rots(page, 'row-hand')).toEqual([0, 1, 0]);
  await touch('touchEnd', [f1(pts[0])]);
  await ctx.close();
});

test('while a card is carried, a quick second-finger tap rotates it before the drop; a moving second finger still pans and rotates nothing (5.1)', async ({ browser }) => {
  const { ctx, page } = await start(browser, 'Carry');
  const cdp = await page.context().newCDPSession(page);
  const f1 = (p: { x: number; y: number }) => ({ ...p, id: 1 });
  const touch = (type: string, points: { x: number; y: number; id: number }[]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const table = center((await page.getByTestId('row-Table').boundingBox())!);
  const board = (await page.locator('.board').boundingBox())!;
  const felt = { x: board.x + 14, y: board.y + board.height - 30 }; // empty table, away from the hand
  const pickUp = async (i: number) => {
    const pts = await stripCenters(page, 'row-hand');
    await touch('touchStart', [f1(pts[i])]);
    await touch('touchMove', [f1({ x: pts[i].x, y: pts[i].y - 40 })]); // pulled up out of the row: a drag
    await touch('touchMove', [f1(table)]);
    await expect(page.locator('.drag-ghost')).toHaveCount(1);
  };

  // a quick tap of a second finger while carrying turns the carried card 45°; the drop keeps it
  await pickUp(1);
  await touch('touchStart', [f1(table), { ...felt, id: 2 }]);
  await page.waitForTimeout(60);
  await touch('touchEnd', [{ ...felt, id: 2 }]);
  await expect.poll(async () => page.locator('.drag-ghost .card-turn').count()).toBe(1); // the carried card shows it at once
  await touch('touchEnd', [f1(table)]);
  await expect(page.getByTestId('row-Table').locator('[data-h]')).toHaveCount(1);
  await expect.poll(() => rots(page, 'row-Table')).toEqual([1]);

  // a second finger that moves is the pan: a drag that began on the board is cancelled and nothing is rotated
  const cardOnTable = center((await page.getByTestId('row-Table').locator('[data-h]').first().boundingBox())!);
  await touch('touchStart', [f1(cardOnTable)]);
  await touch('touchMove', [f1({ x: cardOnTable.x, y: cardOnTable.y - 60 })]); // pulled up out of the spread: a drag
  await expect(page.locator('.drag-ghost')).toHaveCount(1);
  await touch('touchStart', [f1({ x: cardOnTable.x, y: cardOnTable.y - 60 }), { ...felt, id: 2 }]);
  await touch('touchMove', [f1({ x: cardOnTable.x, y: cardOnTable.y - 60 }), { x: felt.x, y: felt.y - 40, id: 2 }]);
  await touch('touchEnd', [{ x: felt.x, y: felt.y - 40, id: 2 }]);
  await touch('touchEnd', [f1({ x: cardOnTable.x, y: cardOnTable.y - 60 })]);
  await page.waitForTimeout(300);
  await expect(page.locator('.drag-ghost')).toHaveCount(0);
  await expect(page.getByTestId('row-Table').locator('[data-h]')).toHaveCount(1);
  expect(await rots(page, 'row-Table')).toEqual([1]); // not rotated again
  await ctx.close();
});

for (const scheme of ['light', 'dark'] as const) {
  test(`the rotate controls and a rotated card are readable in ${scheme} mode (6.1)`, async ({ browser }) => {
    const ctx = await browser.newContext({ ...PHONE, colorScheme: scheme });
    await ctx.addInitScript(() => localStorage.setItem('vct.loupeMode', 'second-finger'));
    const page = await ctx.newPage();
    await onboard(page, 'Alex');
    await createTable(page, `Rot ${scheme} ${Date.now() % 100000}`, { deck: 'builtin-standard-52' });
    await draw(page, 'Standard 52', 3);
    const bad = async (state: string) => {
      const issues = await lowContrast(page);
      expect(issues, `${state}: ${issues.map((i) => `${i.kind} ${i.element} "${i.text}" ${i.ratio} < ${i.required}`).join('\n')}`).toEqual([]);
    };
    await selectHandCard(page, 1);
    await page.getByRole('toolbar', { name: 'Selected cards' }).getByRole('button', { name: 'Rotate 45°' }).click();
    await expect.poll(() => rots(page, 'row-hand')).toEqual([0, 1, 0]);
    await bad('toolbar with Rotate and a rotated card');
    await page.getByRole('toolbar', { name: 'Selected cards' }).getByRole('button', { name: 'Actions…' }).click();
    await expect(page.getByRole('button', { name: 'Upright', exact: true })).toBeVisible();
    await bad('selection sheet with the rotate buttons');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Clear selection' }).click();
    await page.getByTestId('pile-Standard 52').click();
    await expect(page.getByRole('button', { name: 'Rotate all' })).toBeVisible();
    await bad('zone sheet with Rotate all');
    await ctx.close();
  });
}
