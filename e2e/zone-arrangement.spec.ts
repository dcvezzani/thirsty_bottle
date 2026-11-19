import { test, expect, type Page } from '@playwright/test';
import { newPlayer, createTable, joinTable, PHONE } from './helpers';
import { settle } from './table-helpers';

// zone-arrangement e2e

export async function addZones(page: Page, zones: [string, 'pile' | 'spread' | 'column' | 'free'][]) {
  await page.getByRole('button', { name: 'Table settings' }).click();
  for (const [n, layout] of zones) {
    await page.getByLabel('New zone name').fill(n);
    await page.getByLabel('New zone layout').selectOption(layout);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.locator(`section.zone[aria-label="${n}"]`)).toHaveCount(1);
  }
  await page.keyboard.press('Escape');
}

const zoneOrder = (page: Page) => page.locator('.board section.zone').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
const noSideways = (page: Page) =>
  page.evaluate(() => {
    const b = document.querySelector('.board')!;
    return document.documentElement.scrollWidth <= innerWidth && b.scrollWidth <= b.clientWidth;
  });

test('zones appear in the server order on a phone and a desktop, without sideways scrolling (2.2)', async ({ browser }) => {
  const { ctx: c1, page: phone } = await newPlayer(browser, 'Alex', PHONE);
  await createTable(phone, 'Flow order', { deck: 'builtin-standard-52' });
  await addZones(phone, [
    ['A', 'pile'],
    ['B', 'spread'],
    ['C', 'pile'],
  ]);
  const { ctx: c2, page: desk } = await newPlayer(browser, 'Sam', { viewport: { width: 1280, height: 800 } });
  await joinTable(desk, 'Flow order');
  const expected = ['Discard', 'Standard 52', 'Table', 'A', 'B', 'C'];
  await expect.poll(() => zoneOrder(phone)).toEqual(expected);
  await expect.poll(() => zoneOrder(desk)).toEqual(expected);
  expect(await noSideways(phone)).toBe(true);
  expect(await noSideways(desk)).toBe(true);
  // piles share a row; a spread takes a full row
  const top = (p: Page, n: string) => p.locator(`section.zone[aria-label="${n}"]`).evaluate((e) => Math.round(e.getBoundingClientRect().top));
  expect(await top(phone, 'Discard')).toBe(await top(phone, 'Standard 52'));
  expect(await top(phone, 'Table')).toBeGreaterThan(await top(phone, 'Discard'));
  await Promise.all([c1.close(), c2.close()]);
});

test('empty zones are slim 44px bars; dragging a card over one opens it and drops the card in (2.3)', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex', PHONE);
  await createTable(page, 'Slim zones', { deck: 'builtin-standard-52' });
  await addZones(page, [
    ['E1', 'spread'],
    ['E2', 'spread'],
    ['E3', 'spread'],
    ['E4', 'spread'],
  ]);
  for (const n of ['E1', 'E2', 'E3', 'E4']) {
    const h = await page.locator(`section.zone[aria-label="${n}"]`).evaluate((e) => e.getBoundingClientRect().height);
    expect(Math.abs(h - 44)).toBeLessThanOrEqual(1);
  }
  // a card from the hand, dragged over E2's bar
  await page.getByTestId('pile-Standard 52').click();
  await page.getByRole('button', { name: 'Draw 1', exact: true }).click();
  const card = page.getByTestId('row-hand').locator('[data-h]').first();
  await expect(card).toHaveCount(1);
  await page.waitForTimeout(400);
  const c = (await card.boundingBox())!;
  const bar = (await page.locator('section.zone[aria-label="E2"]').boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: string, p?: { x: number; y: number }) => cdp.send('Input.dispatchTouchEvent', { type: type as any, touchPoints: p ? [p] : [] });
  const start = { x: c.x + c.width / 2, y: c.y + c.height / 2 };
  const end = { x: bar.x + bar.width / 2, y: bar.y + bar.height / 2 };
  await touch('touchStart', start);
  for (let i = 1; i <= 8; i++) {
    await page.waitForTimeout(20);
    await touch('touchMove', { x: start.x + ((end.x - start.x) * i) / 8, y: start.y + ((end.y - start.y) * i) / 8 });
  }
  await page.waitForTimeout(150);
  const opened = await page.locator('section.zone[aria-label="E2"]').evaluate((e) => e.getBoundingClientRect().height);
  expect(opened).toBeGreaterThan(70);
  await touch('touchEnd');
  await expect(page.getByTestId('row-E2').locator('[data-h]')).toHaveCount(1);
  await expect(page.getByTestId('row-hand').locator('[data-h]')).toHaveCount(0);
  await ctx.close();
});

async function fillZone(page: Page, zone: string, n: number) {
  await page.getByTestId('pile-Standard 52').click();
  await page.getByRole('button', { name: 'Draw…' }).click();
  await page.locator('#dcount').fill(String(n));
  await page.locator('#dto').selectOption({ label: zone });
  await page.getByRole('button', { name: `Draw ${n}` }).click();
  await expect(page.getByTestId(`row-${zone}`).locator('[data-h]')).toHaveCount(n);
  await settle(page); // the deal animation moves the cards; measure them only after it ends
  await page.waitForTimeout(150);
}
const handles = (page: Page, zone: string) => page.getByTestId(`row-${zone}`).locator('[data-h]').evaluateAll((e) => e.map((x) => x.getAttribute('data-h')));
async function touchPathTo(page: Page, pts: { x: number; y: number }[], end: () => Promise<{ x: number; y: number }>) {
  const cdp = await page.context().newCDPSession(page);
  const t = (type: string, p?: { x: number; y: number }) => cdp.send('Input.dispatchTouchEvent', { type: type as any, touchPoints: p ? [p] : [] });
  await t('touchStart', pts[0]);
  for (const p of pts.slice(1)) {
    await page.waitForTimeout(20);
    await t('touchMove', p);
  }
  // re-aim at the destination (it may open while hovered)
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(40);
    await t('touchMove', await end());
  }
  await t('touchEnd');
}

test('columns: vertical scrub changes nothing; sideways pick-up moves a run; a selected card moves alone (3.2)', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex', PHONE);
  await createTable(page, 'Columns', { deck: 'builtin-standard-52' });
  await addZones(page, [
    ['C1', 'column'],
    ['C2', 'column'],
  ]);
  await fillZone(page, 'C1', 5);
  const c1 = page.getByTestId('row-C1');
  const order = await handles(page, 'C1');
  // face up, like a Solitaire run: each card shows a strip about a fifth of a card tall
  await page.getByRole('button', { name: 'C1 actions' }).click();
  await page.getByRole('button', { name: 'Flip all' }).click();
  await page.keyboard.press('Escape');
  await settle(page);
  await page.waitForTimeout(200);
  const strip = async (i: number) => {
    const b = (await c1.locator('[data-h]').nth(i).boundingBox())!;
    return { x: b.x + b.width / 2, y: b.y + 8 };
  };
  // vertical scrub along the column: nothing changes
  await page.getByRole('button', { name: 'Log', exact: true }).click();
  const logCount = await page.getByLabel('Table log').locator('li').count();
  await page.getByRole('button', { name: 'Log', exact: true }).click();
  // start on the last (fully visible) card and slide up the column
  const lastBox = (await c1.locator('[data-h]').nth(4).boundingBox())!;
  const s0 = { x: lastBox.x + lastBox.width / 2, y: lastBox.y + 20 };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [s0] });
  for (let i = 1; i <= 8; i++) {
    await page.waitForTimeout(20);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: s0.x, y: s0.y - i * 4 }] });
  }
  await expect(c1).toHaveClass(/opened/); // cards near the finger open up while scrubbing
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(c1).not.toHaveClass(/opened/);
  await page.waitForTimeout(300); // the opened cards slide back into place
  expect(await handles(page, 'C1')).toEqual(order);
  await expect(page.locator('.card.selected')).toHaveCount(0);
  // sideways pick-up of the 3rd card takes it and everything below, in order, to the end of C2
  const s2 = await strip(2);
  const c2 = page.locator('section.zone[aria-label="C2"]');
  const c2Aim = async () => {
    const b = (await c2.boundingBox())!;
    return { x: b.x + b.width / 2, y: b.y + Math.min(b.height / 2, 30) };
  };
  await touchPathTo(page, [s2, { x: s2.x + 20, y: s2.y }, { x: s2.x + 60, y: s2.y }], c2Aim);
  await expect(page.getByTestId('row-C2').locator('[data-h]')).toHaveCount(3);
  expect(await handles(page, 'C2')).toEqual(order.slice(2));
  expect(await handles(page, 'C1')).toEqual(order.slice(0, 2));
  // a selected single card moves alone
  await settle(page);
  await page.waitForTimeout(200);
  const first = await strip(0);
  await page.touchscreen.tap(first.x, first.y);
  await expect(page.locator('.card.selected')).toHaveCount(1);
  const f = first;
  await touchPathTo(page, [f, { x: f.x + 20, y: f.y }, { x: f.x + 60, y: f.y }], c2Aim);
  await expect(page.getByTestId('row-C2').locator('[data-h]')).toHaveCount(4);
  expect(await handles(page, 'C1')).toEqual([order[1]]);
  expect((await handles(page, 'C2')).at(-1)).toBe(order[0]);
  await page.getByRole('button', { name: 'Log', exact: true }).click();
  await expect(page.getByLabel('Table log').locator('li')).toHaveCount(logCount + 2); // the run move and the single move
  await ctx.close();
});

test('columns: mouse hover opens the cards under the pointer on desktop (3.2)', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex', { viewport: { width: 1280, height: 800 } });
  await createTable(page, 'Column hover', { deck: 'builtin-standard-52' });
  await addZones(page, [['C1', 'column']]);
  await fillZone(page, 'C1', 6);
  const c1 = page.getByTestId('row-C1');
  const card = c1.locator('[data-h]').nth(2);
  const before = (await c1.locator('[data-h]').nth(3).boundingBox())!.y;
  const b = (await card.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + 3);
  await expect(c1).toHaveClass(/opened/);
  await expect.poll(async () => (await c1.locator('[data-h]').nth(3).boundingBox())!.y).toBeGreaterThan(before + 20);
  await page.mouse.move(5, 5);
  await expect(c1).not.toHaveClass(/opened/);
  await ctx.close();
});
