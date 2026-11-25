import { test, expect, type Page } from '@playwright/test';
import { newPlayer, createTable, joinTable, draw, PHONE } from './helpers';
import { stripCenters, handles, touchPath, line, settle, type Pt } from './table-helpers';

async function vibrations(page: Page) {
  return page.evaluate(() => (window as any).__vib.length as number);
}

async function setupHand(browser: any, n = 8, name = 'Gestures') {
  const ctx = await browser.newContext(PHONE);
  await ctx.addInitScript(() => {
    (window as any).__vib = [];
    Object.defineProperty(navigator, 'vibrate', { value: (ms: number) => ((window as any).__vib.push(ms), true), configurable: true });
  });
  const page = await ctx.newPage();
  const { onboard } = await import('./helpers');
  await onboard(page, 'Alex');
  await createTable(page, name, { deck: 'builtin-standard-52' });
  await draw(page, 'Standard 52', n);
  await expect(page.getByTestId('row-hand').locator('[data-h]')).toHaveCount(n);
  return { ctx, page };
}

/** Scrub across points, calling `each` after every move (finger still down). */
async function scrub(page: Page, pts: Pt[], each?: (i: number) => Promise<void>, release = true) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pts[0]] });
  // a short sideways nudge on the first card starts the scrub there
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: pts[0].x + 9, y: pts[0].y }] });
  await page.waitForTimeout(30);
  if (each) await each(0);
  for (let i = 1; i < pts.length; i++) {
    // small intermediate step so the first move passes the slop horizontally
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pts[i]] });
    await page.waitForTimeout(30);
    if (each) await each(i);
  }
  if (release) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  return cdp;
}

test('scrub to preview: each card enlarges in turn with a haptic tick; releasing changes nothing (9.4)', async ({ browser }) => {
  const { ctx, page } = await setupHand(browser, 8);
  const pts = await stripCenters(page, 'row-hand');
  const before = await handles(page, 'row-hand');
  const seen: string[] = [];
  await scrub(page, pts, async () => {
    const f = await page.locator('.card.focused').getAttribute('data-h');
    if (f && seen.at(-1) !== f) seen.push(f);
  });
  expect(seen).toEqual(before); // every card previewed, in order
  expect(await vibrations(page)).toBeGreaterThanOrEqual(8);
  await settle(page);
  await expect(page.locator('.card.focused')).toHaveCount(0);
  await expect(page.getByTestId('selection-count')).toHaveCount(0);
  expect(await handles(page, 'row-hand')).toEqual(before);

  // scrubbing a spread with face-down cards previews only backs
  await page.getByTestId('pile-Standard 52').click();
  await page.getByRole('button', { name: 'Draw…' }).click();
  await page.locator('#dcount').fill('4');
  await page.locator('#dto').selectOption({ label: 'Table' });
  await page.getByRole('button', { name: 'Draw 4' }).click();
  await expect(page.getByTestId('row-Table').locator('[data-h]')).toHaveCount(4);
  const tpts = await stripCenters(page, 'row-Table');
  let backs = 0;
  await scrub(page, tpts, async () => {
    if (await page.locator('.card.focused.back').count()) backs++;
    expect(await page.locator('.card.focused.face').count()).toBe(0);
  });
  expect(backs).toBeGreaterThanOrEqual(3);

  // fan out a pile: scrub through it, order unchanged afterwards
  const pileTop = await page.getByTestId('pile-Standard 52').locator('[data-h]').last().getAttribute('data-h');
  await page.getByTestId('pile-Standard 52').click();
  await page.getByRole('button', { name: 'Fan out' }).click();
  const fan = page.getByRole('dialog').getByTestId('row-Standard 52');
  await expect(fan.locator('[data-h]')).toHaveCount(40);
  const fpts = await stripCenters(page, 'row-Standard 52');
  await scrub(page, fpts.slice(0, 12));
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('pile-Standard 52').locator('[data-h]').last()).toHaveAttribute('data-h', pileTop!);
  await ctx.close();
});

test('paint selection: tap + scrub selects 5; scrubbing from a selected card deselects (9.5)', async ({ browser }) => {
  const { ctx, page } = await setupHand(browser, 9);
  const pts = await stripCenters(page, 'row-hand');
  await page.touchscreen.tap(pts[1].x, pts[1].y);
  await expect(page.getByTestId('selection-count')).toHaveText('1 selected');
  await settle(page);
  const p2 = await stripCenters(page, 'row-hand');
  // stroke starts on the unselected neighbour and covers 4 cards: 1 + 4 = 5 selected
  await scrub(page, [p2[2], p2[3], p2[4], p2[5]]);
  await expect(page.getByTestId('selection-count')).toHaveText('5 selected');
  const sel = await page.locator('[data-testid=row-hand] .card.selected').evaluateAll((e) => e.map((x) => (x as HTMLElement).dataset.h));
  const hs = await handles(page, 'row-hand');
  expect(sel.sort()).toEqual(hs.slice(1, 6).sort());
  // scrub starting on a selected card across 2 other selected cards → those 3 deselected
  const p3 = await stripCenters(page, 'row-hand');
  await scrub(page, [p3[1], p3[2], p3[3]]);
  await expect(page.getByTestId('selection-count')).toHaveText('2 selected');
  // Select all (in the Actions sheet) / Clear (the toolbar's ✕)
  await page.getByRole('button', { name: 'Actions…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Select all' }).click();
  await expect(page.getByTestId('selection-count')).toHaveText('9 selected');
  await page.getByRole('button', { name: 'Clear selection' }).click();
  await expect(page.getByTestId('selection-count')).toHaveCount(0);
  await ctx.close();
});

test('desktop: hover previews, click selects, shift+click selects a range', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex', { viewport: { width: 1280, height: 800 } });
  await createTable(page, 'Desk', { deck: 'builtin-standard-52' });
  await draw(page, 'Standard 52', 10);
  const pts = await stripCenters(page, 'row-hand');
  await page.mouse.move(pts[3].x, pts[3].y);
  const hs = await handles(page, 'row-hand');
  await expect(page.locator('.card.focused')).toHaveAttribute('data-h', hs[3]);
  await page.mouse.click(pts[2].x, pts[2].y);
  await page.keyboard.down('Shift');
  await page.mouse.click(pts[6].x, pts[6].y);
  await page.keyboard.up('Shift');
  await expect(page.getByTestId('selection-count')).toHaveText('5 selected');
  await ctx.close();
});

test('group drag: 5 cards passed in one drag, one log entry, one undo restores all (9.6)', async ({ browser }) => {
  const { ctx, page } = await setupHand(browser, 8, 'Group drag');
  const { ctx: c2, page: sam } = await newPlayer(browser, 'Sam', PHONE);
  await joinTable(sam, 'Group drag');
  await expect(page.getByTestId('seat-Sam')).toBeVisible();
  const pts = await stripCenters(page, 'row-hand');
  await page.touchscreen.tap(pts[0].x, pts[0].y);
  await settle(page);
  const p2 = await stripCenters(page, 'row-hand');
  await scrub(page, [p2[1], ...p2.slice(2, 5)]);
  await expect(page.getByTestId('selection-count')).toHaveText('5 selected');
  const names = () => page.getByTestId('row-hand').locator('[data-h]').evaluateAll((e) => e.map((x) => x.getAttribute('aria-label')));
  const five = (await names()).slice(0, 5);
  await settle(page);
  const p3 = await stripCenters(page, 'row-hand');
  const seat = (await page.getByTestId('seat-Sam').boundingBox())!;
  const target = { x: seat.x + seat.width / 2, y: seat.y + seat.height / 2 };
  // pull up from a selected card and drop the stack on Sam's seat; Sam sees a live preview meanwhile
  const cdp = await touchPath(page, [p3[2], { x: p3[2].x, y: p3[2].y - 20 }, ...line({ x: p3[2].x, y: p3[2].y - 20 }, target, 12)], { release: false });
  await expect(page.locator('.drag-count')).toHaveText('5');
  await expect(page.getByTestId('seat-Sam')).toHaveClass(/drop-over/);
  await expect(sam.getByTestId('other-drag')).toBeVisible();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(sam.getByTestId('row-hand').locator('[data-h]')).toHaveCount(5);
  await expect(page.getByTestId('row-hand').locator('[data-h]')).toHaveCount(3);
  await expect(sam.getByTestId('other-drag')).toHaveCount(0);
  await page.getByRole('button', { name: 'Log', exact: true }).click();
  const entries = await page.getByLabel('Table log').locator('li').allInnerTexts();
  expect(entries.filter((t) => t.includes('passed')).length).toBe(1);
  expect(entries[0]).toMatch(/You passed .* to Sam/);
  await page.getByRole('button', { name: 'Log', exact: true }).click();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByTestId('row-hand').locator('[data-h]')).toHaveCount(8);
  await expect(sam.getByTestId('row-hand').locator('[data-h]')).toHaveCount(0);
  // handles of hidden cards are regenerated, so compare identities
  expect((await names()).slice(0, 5)).toEqual(five);
  await Promise.all([ctx.close(), c2.close()]);
});
