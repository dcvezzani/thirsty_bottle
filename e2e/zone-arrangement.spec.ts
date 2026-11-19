import { test, expect, type Page } from '@playwright/test';
import { newPlayer, createTable, joinTable, PHONE } from './helpers';

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
