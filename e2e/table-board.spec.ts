import { test, expect } from '@playwright/test';
import { newPlayer, createTable, joinTable, draw, PHONE } from './helpers';
import { makeDeck, stripCenters, touchPath, line, handles } from './table-helpers';
import fs from 'node:fs';

test('board renderer at 375px and 1280px with copy-number badges and seat indicators (9.1)', async ({ browser }) => {
  for (const vp of [PHONE, { viewport: { width: 1280, height: 800 } }]) {
    const { ctx, page } = await newPlayer(browser, 'Alex', vp);
    const deckId = await makeDeck(page, 'Monsters', [
      { name: 'Goblin', count: 3 },
      { name: 'Orc', count: 1 },
    ]);
    await page.goto('/');
    await createTable(page, `Board ${vp.viewport.width}`, { deck: deckId });
    const { ctx: c2, page: sam } = await newPlayer(browser, 'Sam', vp);
    await joinTable(sam, `Board ${vp.viewport.width}`);
    await page.getByTestId('pile-Monsters').click();
    await page.getByRole('button', { name: 'Flip all' }).click();
    // move the 4 face-up cards into the Table spread
    for (let i = 0; i < 4; i++) {
      await page.getByTestId('pile-Monsters').click();
      await page.getByRole('button', { name: 'Draw…' }).click();
      await page.locator('#dto').selectOption({ label: 'Table' });
      await page.getByRole('button', { name: 'Draw 1' }).click();
    }
    await expect(page.getByTestId('row-Table').locator('[data-h]')).toHaveCount(4);
    const badges = await page.getByTestId('row-Table').getByTestId('copy-badge').allInnerTexts();
    expect(badges.sort()).toEqual(['1/3', '2/3', '3/3']); // no badge for the single Orc
    await page.getByRole('button', { name: 'Mode: real-time (tap to switch)' }).click();
    await expect(page.getByTestId('turn-bar')).toHaveText(/Your turn/);
    await expect(sam.getByTestId('seat-Alex')).toHaveClass(/active/);
    fs.mkdirSync('test-results/screens', { recursive: true });
    await page.screenshot({ path: `test-results/screens/board-${vp.viewport.width}.png` });
    await sam.screenshot({ path: `test-results/screens/board-${vp.viewport.width}-sam.png` });
    // disconnected indicator
    await sam.close();
    await expect(page.getByTestId('seat-Sam')).toHaveAttribute('aria-label', /disconnected/, { timeout: 10_000 });
    await Promise.all([ctx.close(), c2.close()]);
  }
});

test('20 cards in a 375px hand all stay tappable (9.2)', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex', PHONE);
  await createTable(page, 'Big hand', { deck: 'builtin-standard-52' });
  await draw(page, 'Standard 52', 20);
  await expect(page.getByTestId('row-hand').locator('[data-h]')).toHaveCount(20);
  const pts = await stripCenters(page, 'row-hand');
  const box = await page.getByTestId('row-hand').boundingBox();
  for (const p of pts) {
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x).toBeLessThanOrEqual(375);
  }
  for (const p of pts) await page.touchscreen.tap(p.x, p.y);
  await expect(page.getByTestId('selection-count')).toHaveText('20 selected');
  expect(box!.width).toBeLessThanOrEqual(375);
  // desktop-style reorder by dragging within the hand: pull the first card to the end
  await page.getByRole('button', { name: 'Clear selection' }).click();
  const before = await handles(page, 'row-hand');
  const p0 = pts[0];
  const end = pts[19];
  await touchPath(page, [p0, { x: p0.x, y: p0.y - 15 }, ...line({ x: p0.x, y: p0.y - 15 }, { x: Math.min(370, end.x + 4), y: end.y - 10 }, 10)]);
  await expect.poll(async () => (await handles(page, 'row-hand')).at(-1)).toBe(before[0]);
  await ctx.close();
});
