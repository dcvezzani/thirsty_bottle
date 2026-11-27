import { test, expect } from '@playwright/test';
import { onboard, createTable, draw, PHONE } from './helpers';
import { stripCenters, settle } from './table-helpers';
import { lowContrast } from './contrast';

async function startHand(browser: any, name: string, n = 8, mode: 'second-finger' | 'stay' = 'second-finger') {
  const ctx = await browser.newContext(PHONE);
  await ctx.addInitScript((m: string) => localStorage.setItem('vct.loupeMode', m), mode);
  const page = await ctx.newPage();
  await onboard(page, 'Alex');
  await createTable(page, name, { deck: 'builtin-standard-52' });
  await draw(page, 'Standard 52', n);
  await expect(page.getByTestId('row-hand').locator('[data-h]')).toHaveCount(n);
  return { ctx, page };
}

test('scrubbing shows the card large in a loupe that does not cover the row; a pause shows its details; release removes it (2.1)', async ({ browser }) => {
  const { ctx, page } = await startHand(browser, `Loupe ${Date.now() % 100000}`);
  const pts = await stripCenters(page, 'row-hand');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pts[1]] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: pts[1].x + 10, y: pts[1].y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pts[3]] });

  const loupe = page.getByTestId('loupe');
  await expect(loupe).toBeVisible();
  await expect(loupe).toHaveAttribute('data-side', 'top');
  const lb = (await loupe.boundingBox())!;
  const rb = (await page.getByTestId('row-hand').boundingBox())!;
  expect(lb.y + lb.height).toBeLessThanOrEqual(rb.y); // never over the zone being scrubbed
  const card = (await loupe.locator('.card').boundingBox())!;
  expect(card.width).toBeGreaterThan(110); // a lot bigger than a card in the row
  // loupe-viewport-size: docked at the very top of the view, nearly full width, tall (up to 60% of the screen), covering the header
  const vp = page.viewportSize()!;
  expect(lb.y).toBeLessThanOrEqual(12);
  expect(lb.width).toBeGreaterThan(vp.width - 24);
  expect(lb.height).toBeGreaterThanOrEqual(vp.height * 0.35 - 2);
  expect(lb.height).toBeLessThanOrEqual(vp.height * 0.6 + 2);
  expect(card.height).toBeGreaterThan(lb.height - 80); // the card fills the box
  await expect(page.getByTestId('loupe-details')).toHaveCount(0);

  // hold still: the loupe fills in the details; moving on returns to the large card
  await page.waitForTimeout(450);
  await expect(page.getByTestId('loupe-details')).toBeVisible();
  await expect(page.getByTestId('loupe-details')).toContainText('Copy 1 of 1');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pts[5]] });
  await expect(page.getByTestId('loupe-details')).toHaveCount(0);

  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(loupe).toHaveCount(0);
  await expect(page.getByTestId('row-hand').locator('[data-h]')).toHaveCount(8); // nothing changed
  await ctx.close();
});

test('a scrub carries on from one zone into the next, wraps rows, and comes back (3.1)', async ({ browser }) => {
  const { ctx, page } = await startHand(browser, `Strip ${Date.now() % 100000}`, 1);
  // a second spread next to Table, three cards in each
  await page.getByRole('button', { name: 'Table settings' }).click();
  await page.getByLabel('New zone name').fill('B');
  await page.getByLabel('New zone layout').selectOption('spread');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('section.zone[aria-label="B"]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  for (const to of ['Table', 'B']) {
    await page.getByTestId('pile-Standard 52').click();
    await page.getByRole('button', { name: 'Draw…' }).click();
    await page.locator('#dcount').fill('3');
    await page.locator('#dto').selectOption({ label: to });
    await page.getByRole('button', { name: 'Draw 3' }).click();
    await expect(page.getByTestId(`row-${to}`).locator('[data-h]')).toHaveCount(3);
  }
  const ty = (await page.getByTestId('row-Table').boundingBox())!.y;
  const by = (await page.getByTestId('row-B').boundingBox())!.y;
  expect(by).toBeGreaterThan(ty + 50); // B is on the next row, so this crosses a row wrap
  const t = await stripCenters(page, 'row-Table');
  const vw = page.viewportSize()!.width;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [t[0]] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: t[0].x + 10, y: t[0].y }] });
  await expect(page.getByTestId('row-Table').locator('.card.focused')).toHaveCount(1);

  // slide right across the end of Table: the scrub continues into B
  for (let x = t[0].x + 20; x < vw - 4; x += 12) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: t[0].y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: vw - 4, y: t[0].y }] });
  await expect(page.getByTestId('row-B').locator('.card.focused')).toHaveCount(1);
  await expect(page.getByTestId('row-Table').locator('.card.focused')).toHaveCount(0);
  await expect(page.getByTestId('loupe')).toContainText('B');

  // and back: the scrub returns to Table
  for (let x = vw - 16; x > t[0].x; x -= 12) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: t[0].y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: t[0].x, y: t[0].y }] });
  await expect(page.getByTestId('row-Table').locator('.card.focused')).toHaveCount(1);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.getByTestId('loupe')).toHaveCount(0);
  await ctx.close();
});

async function twoSpreads(page: any) {
  await page.getByRole('button', { name: 'Table settings' }).click();
  await page.getByLabel('New zone name').fill('B');
  await page.getByLabel('New zone layout').selectOption('spread');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('section.zone[aria-label="B"]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  // both spreads are narrow "fit" zones sharing a row
  for (const n of ['Table', 'B']) {
    await page.getByRole('button', { name: `${n} actions` }).click();
    await page.getByRole('group', { name: 'Width' }).getByRole('button', { name: 'Fit' }).click();
    await page.keyboard.press('Escape');
  }
  for (const to of ['Table', 'B']) {
    await page.getByTestId('pile-Standard 52').click();
    await page.getByRole('button', { name: 'Draw…' }).click();
    await page.locator('#dcount').fill('4');
    await page.locator('#dto').selectOption({ label: to });
    await page.getByRole('button', { name: 'Draw 4' }).click();
    await expect(page.getByTestId(`row-${to}`).locator('[data-h]')).toHaveCount(4);
  }
}

test('holding a carried card over a zone opens it, the drop lands in the chosen slot, and the zone closes; passing over does not open it (4.1)', async ({ browser }) => {
  const { ctx, page } = await startHand(browser, `Open ${Date.now() % 100000}`, 1);
  await twoSpreads(page);
  await settle(page);
  const zoneB = page.locator('section.zone[aria-label="B"]');
  const widthB = (await zoneB.boundingBox())!.width;
  const t = await stripCenters(page, 'row-Table');
  const bBox = (await page.getByTestId('row-B').boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const send = (type: string, p?: { x: number; y: number }) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [p] : [] });

  // pick up the first Table card (pull up out of the row), then sweep across B without stopping
  await send('touchStart', t[0]);
  await send('touchMove', { x: t[0].x, y: t[0].y - 40 });
  const mid = { x: bBox.x + bBox.width / 2, y: bBox.y + bBox.height / 2 };
  for (let i = 1; i <= 6; i++) await send('touchMove', { x: t[0].x + ((mid.x - t[0].x) * i) / 6, y: t[0].y - 40 + ((mid.y - (t[0].y - 40)) * i) / 6 });
  await expect(zoneB).not.toHaveClass(/is-open/);

  // hold over B: it opens and widens
  await page.waitForTimeout(450);
  await expect(zoneB).toHaveClass(/is-open/);
  expect((await zoneB.boundingBox())!.width).toBeGreaterThan(widthB);

  // slide to the start of the opened zone and release: the card lands in B, and the zone closes
  await page.waitForTimeout(250); // the zone's width transition has finished
  const open = (await page.getByTestId('row-B').boundingBox())!;
  await send('touchMove', { x: open.x + 6, y: open.y + open.height / 2 });
  await page.waitForTimeout(80);
  await send('touchEnd');
  await expect(page.getByTestId('row-B').locator('[data-h]')).toHaveCount(5);
  await expect(page.getByTestId('row-Table').locator('[data-h]')).toHaveCount(3);
  await expect(zoneB).not.toHaveClass(/is-open/);
  await ctx.close();
});

test('a pause while scrubbing pins the zone open after release; cards can be selected; the felt closes it and keeps the selection (4.2)', async ({ browser }) => {
  const { ctx, page } = await startHand(browser, `Pin ${Date.now() % 100000}`, 1);
  await twoSpreads(page);
  await settle(page);
  const zoneB = page.locator('section.zone[aria-label="B"]');
  const widthB = (await zoneB.boundingBox())!.width;
  const b = await stripCenters(page, 'row-B');
  const cdp = await page.context().newCDPSession(page);
  const send = (type: string, p?: { x: number; y: number }) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [p] : [] });
  await send('touchStart', b[0]);
  await send('touchMove', { x: b[0].x + 10, y: b[0].y });
  await send('touchMove', b[1]);
  await page.waitForTimeout(450);
  await send('touchEnd');

  // released, and still open and wide
  await expect(zoneB).toHaveClass(/is-open/);
  await settle(page);
  expect((await zoneB.boundingBox())!.width).toBeGreaterThan(widthB);

  // select two cards in it; it stays open
  const cards = page.getByTestId('row-B').locator('[data-h]');
  await cards.nth(0).click({ position: { x: 4, y: 20 } });
  await cards.nth(2).click({ position: { x: 4, y: 20 } });
  await expect(page.getByTestId('sel-count')).toHaveText('2');
  await expect(zoneB).toHaveClass(/is-open/);

  // a tap on the header closes it; the selection stays
  await page.locator('.table-top h1').click();
  await expect(zoneB).not.toHaveClass(/is-open/);
  await expect(page.getByRole('toolbar', { name: 'Selected cards' })).toBeVisible();

  // pin again, then clearing the selection closes it
  const b2 = await stripCenters(page, 'row-B');
  await send('touchStart', b2[0]);
  await send('touchMove', { x: b2[0].x + 10, y: b2[0].y });
  await send('touchMove', b2[1]);
  await page.waitForTimeout(450);
  await send('touchEnd');
  await expect(zoneB).toHaveClass(/is-open/);
  await page.getByRole('toolbar', { name: 'Selected cards' }).getByRole('button', { name: 'Clear selection' }).click();
  await expect(zoneB).not.toHaveClass(/is-open/);
  await ctx.close();
});

for (const scheme of ['light', 'dark'] as const) {
  test(`the loupe and its details are readable in ${scheme} mode (5.1)`, async ({ browser }) => {
    const ctx = await browser.newContext({ ...PHONE, colorScheme: scheme });
    await ctx.addInitScript(() => localStorage.setItem('vct.loupeMode', 'second-finger'));
    const page = await ctx.newPage();
    await onboard(page, 'Alex');
    await createTable(page, `Loupe ${scheme} ${Date.now() % 100000}`, { deck: 'builtin-standard-52' });
    await draw(page, 'Standard 52', 6);
    const pts = await stripCenters(page, 'row-hand');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pts[1]] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: pts[1].x + 10, y: pts[1].y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pts[3]] });
    await expect(page.getByTestId('loupe')).toBeVisible();
    const bad = async (state: string) => {
      const issues = await lowContrast(page);
      expect(issues, `${state}: ${issues.map((i) => `${i.kind} ${i.element} "${i.text}" ${i.ratio} < ${i.required}`).join('\n')}`).toEqual([]);
    };
    await bad('loupe');
    await expect(page.getByTestId('loupe-details')).toBeVisible({ timeout: 3000 });
    await bad('loupe details');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await ctx.close();
  });
}

const center = (b: { x: number; y: number; width: number; height: number }) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

test('second finger: a quick tap on the loupe switches card and details while the scrub carries on; a held finger does not; release removes it (2.1)', async ({ browser }) => {
  const { ctx, page } = await startHand(browser, `Second ${Date.now() % 100000}`);
  const pts = await stripCenters(page, 'row-hand');
  const cdp = await page.context().newCDPSession(page);
  const f1 = (p: { x: number; y: number }) => ({ ...p, id: 1 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [f1(pts[1])] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [f1({ x: pts[1].x + 10, y: pts[1].y })] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [f1(pts[2])] });
  const loupe = page.getByTestId('loupe');
  await expect(loupe).toBeVisible();
  await expect(page.getByTestId('loupe-details')).toHaveCount(0);
  const at = center((await loupe.boundingBox())!);
  const f2 = { ...at, id: 2 };

  const tap2 = async (on: { x: number; y: number }) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [f1(on), f2] });
    await page.waitForTimeout(60);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [f2] });
  };
  const details = page.getByTestId('loupe-details');
  const trueFull = page.getByTestId('loupe-true');

  // holding still shows details as a peek; a tap of the second finger then goes on to the true full view,
  // and a pause does not peek again, even on the next card
  await page.waitForTimeout(450);
  await expect(details).toBeVisible();
  await tap2(pts[2]);
  await expect(details).toHaveCount(0);
  await expect(trueFull).toBeVisible();
  await page.waitForTimeout(450);
  await expect(details).toHaveCount(0);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [f1(pts[3])] });
  await page.waitForTimeout(450);
  await expect(details).toHaveCount(0);
  await expect(trueFull).toBeVisible();

  // the next tap goes back to the card, the one after to details, and the details stay on the next card scrubbed
  await tap2(pts[3]);
  await expect(trueFull).toHaveCount(0);
  await expect(details).toHaveCount(0);
  await tap2(pts[3]);
  await expect(details).toBeVisible();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [f1(pts[4])] });
  await expect(details).toBeVisible();

  // a second finger that holds does nothing
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [f1(pts[4]), f2] });
  await page.waitForTimeout(450);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [f2] });
  await expect(details).toBeVisible();

  // a quick tap again (after moving on, so a pause is not peeking at details): on to the true full view
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [f1(pts[5])] });
  await tap2(pts[5]);
  await expect(details).toHaveCount(0);
  await expect(trueFull).toBeVisible();
  await expect(loupe).toBeVisible(); // the scrub never stopped

  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [f1(pts[5])] });
  await expect(loupe).toHaveCount(0);
  await expect(page.locator('.card.viewed')).toHaveCount(0);
  await ctx.close();
});

test('stay open: release leaves the card viewed with Card/Details buttons and nothing selected; every way of ending it works (3.1)', async ({ browser }) => {
  const { ctx, page } = await startHand(browser, `Stay ${Date.now() % 100000}`, 8, 'stay');
  const loupe = page.getByTestId('loupe');
  const cdp = await page.context().newCDPSession(page);
  const scrubAndLift = async () => {
    const pts = await stripCenters(page, 'row-hand');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pts[1]] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: pts[1].x + 10, y: pts[1].y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pts[3]] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('.card.viewed')).toHaveCount(1);
  };
  await scrubAndLift();
  await expect(loupe).toBeVisible();
  await expect(page.getByTestId('selection-count')).toHaveCount(0);
  await expect(page.getByRole('toolbar', { name: 'Selected cards' })).toHaveCount(0);
  await expect(page.locator('.card.selected')).toHaveCount(0);

  // the buttons switch views, and the choice is kept for the next scrub
  await loupe.getByRole('button', { name: 'Details' }).click();
  await expect(page.getByTestId('loupe-details')).toBeVisible();
  await loupe.getByRole('button', { name: 'Card' }).click();
  await expect(page.getByTestId('loupe-details')).toHaveCount(0);

  // ends: the close button
  await loupe.getByRole('button', { name: 'Close loupe' }).click();
  await expect(loupe).toHaveCount(0);
  await expect(page.locator('.card.viewed')).toHaveCount(0);

  // Escape
  await scrubAndLift();
  await page.keyboard.press('Escape');
  await expect(loupe).toHaveCount(0);

  // scrolling the board does not end it; a tap on the felt does
  await scrubAndLift();
  await page.mouse.wheel(0, 120);
  await expect(loupe).toBeVisible();
  const board = (await page.locator('.board').boundingBox())!;
  await page.mouse.click(board.x + 14, board.y + board.height - 30); // empty felt, away from the hand's fan
  await expect(loupe).toHaveCount(0);

  // a tap on the viewed card ends the viewing and does not select it
  await scrubAndLift();
  await page.locator('.card.viewed').click({ position: { x: 4, y: 20 } });
  await expect(loupe).toHaveCount(0);
  await expect(page.locator('.card.selected')).toHaveCount(0);

  // a tap that selects another card ends it
  await scrubAndLift();
  const hp = await stripCenters(page, 'row-hand');
  await page.mouse.click(hp[6].x, hp[6].y);
  await expect(loupe).toHaveCount(0);
  await expect(page.locator('.card.selected')).toHaveCount(1);
  await page.getByRole('button', { name: 'Clear selection' }).click();

  // another scrub replaces it; opening a sheet ends it
  await scrubAndLift();
  await page.getByTestId('pile-Standard 52').click();
  await expect(loupe).toHaveCount(0);
  await expect(page.locator('.card.viewed')).toHaveCount(0);
  await ctx.close();
});

test('the Card loupe preference is chosen in the table settings and kept after a reload (4.1)', async ({ browser }) => {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  await onboard(page, 'Alex');
  await createTable(page, `Pref ${Date.now() % 100000}`, { deck: 'builtin-standard-52' });
  await page.getByRole('button', { name: 'Table settings' }).click();
  await page.getByRole('radiogroup', { name: 'Card loupe' }).getByLabel(/Stay open/).check();
  await page.keyboard.press('Escape');
  await page.reload();
  await page.getByRole('button', { name: 'Table settings' }).click();
  await expect(page.getByRole('radiogroup', { name: 'Card loupe' }).getByLabel(/Stay open/)).toBeChecked();
  await page.getByRole('radiogroup', { name: 'Card loupe' }).getByLabel(/Second finger/).check();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('vct.loupeMode'))).toBe('second-finger');
  await ctx.close();
});

for (const scheme of ['light', 'dark'] as const) {
  test(`the stay-open loupe buttons and the viewed outline are readable in ${scheme} mode (4.1)`, async ({ browser }) => {
    const ctx = await browser.newContext({ ...PHONE, colorScheme: scheme });
    await ctx.addInitScript(() => localStorage.setItem('vct.loupeMode', 'stay'));
    const page = await ctx.newPage();
    await onboard(page, 'Alex');
    await createTable(page, `Stay ${scheme} ${Date.now() % 100000}`, { deck: 'builtin-standard-52' });
    await draw(page, 'Standard 52', 6);
    const pts = await stripCenters(page, 'row-hand');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pts[1]] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: pts[1].x + 10, y: pts[1].y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pts[3]] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.getByRole('dialog', { name: /./ }).getByRole('button', { name: 'Details' })).toBeVisible();
    for (const [state, action] of [['stay-open loupe', async () => {}], ['stay-open details', async () => page.getByRole('button', { name: 'Details' }).click()], ['stay-open true full', async () => page.getByRole('button', { name: 'True full' }).click()]] as const) {
      await action();
      const issues = await lowContrast(page);
      expect(issues, `${state}: ${issues.map((i) => `${i.kind} ${i.element} "${i.text}" ${i.ratio} < ${i.required}`).join('\n')}`).toEqual([]);
    }
    await ctx.close();
  });
}

test('second finger on a board zone: hold pins the zone, a tap on the loupe still switches the view and leaves the zone open (2.1)', async ({ browser }) => {
  const { ctx, page } = await startHand(browser, `Board tap ${Date.now() % 100000}`, 1);
  await twoSpreads(page);
  await settle(page);
  const b = await stripCenters(page, 'row-B');
  const cdp = await page.context().newCDPSession(page);
  const f1 = (p: { x: number; y: number }) => ({ ...p, id: 1 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [f1(b[0])] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [f1({ x: b[0].x + 10, y: b[0].y })] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [f1(b[1])] });
  await page.waitForTimeout(450); // the pause: details peek, and the zone is pinned open
  await expect(page.getByTestId('loupe-details')).toBeVisible();
  await expect(page.locator('section.zone[aria-label="B"]')).toHaveClass(/is-open/);
  const at = center((await page.getByTestId('loupe').boundingBox())!);
  const f2 = { ...at, id: 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [f1(b[1]), f2] });
  await page.waitForTimeout(60);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [f2] });
  await expect(page.getByTestId('loupe-details')).toHaveCount(0);
  await expect(page.locator('section.zone[aria-label="B"]')).toHaveClass(/is-open/);
  await expect(page.locator('.card.selected')).toHaveCount(0);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [f1(b[1])] });
  await ctx.close();
});

test('loupe-viewport-size: a board zone scrub docks the loupe on the roomier edge, inside the view, clear of the zone (2.1)', async ({ browser }) => {
  const { ctx, page } = await startHand(browser, `Dock ${Date.now() % 100000}`, 1);
  await twoSpreads(page);
  await settle(page);
  const b = await stripCenters(page, 'row-B');
  const zb = (await page.locator('section.zone[aria-label="B"]').boundingBox())!;
  const vp = page.viewportSize()!;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [b[0]] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: b[0].x + 10, y: b[0].y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [b[1]] });
  const loupe = page.getByTestId('loupe');
  await expect(loupe).toBeVisible();
  const lb = (await loupe.boundingBox())!;
  const side = await loupe.getAttribute('data-side');
  expect(lb.y).toBeGreaterThanOrEqual(0);
  expect(lb.y + lb.height).toBeLessThanOrEqual(vp.height);
  const roomier = zb.y >= vp.height - (zb.y + zb.height) ? 'top' : 'bottom';
  expect(side).toBe(roomier);
  if (side === 'top') expect(lb.y + lb.height).toBeLessThanOrEqual(zb.y + 1);
  else expect(lb.y).toBeGreaterThanOrEqual(zb.y + zb.height - 1);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await ctx.close();
});
