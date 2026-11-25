import { test, expect } from '@playwright/test';
import { onboard, createTable, draw, PHONE } from './helpers';
import { stripCenters, settle } from './table-helpers';
import { lowContrast } from './contrast';

async function startHand(browser: any, name: string, n = 8) {
  const ctx = await browser.newContext(PHONE);
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
  const carried = (await page.getByTestId('row-Table').locator('[data-h]').first().getAttribute('data-h'))!;

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

  // slide to the start of the opened zone and release: the card lands first in B, and the zone closes
  const open = (await page.getByTestId('row-B').boundingBox())!;
  await send('touchMove', { x: open.x + 6, y: open.y + open.height / 2 });
  await page.waitForTimeout(80);
  await send('touchEnd');
  await expect(page.getByTestId('row-B').locator('[data-h]')).toHaveCount(5);
  await expect.poll(async () => page.getByTestId('row-B').locator('[data-h]').first().getAttribute('data-h')).toBe(carried);
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
