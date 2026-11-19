import { test, expect, type Page } from '@playwright/test';
import { newPlayer, createTable, PHONE } from './helpers';
import { touchPath, type Pt } from './table-helpers';

// table-scrolling: card-handling "One-finger scrolling outside cards", "Two-finger scrolling", "Scrolling while dragging"

async function addZones(page: Page, names: string[]) {
  await page.getByRole('button', { name: 'Table settings' }).click();
  for (const n of names) {
    await page.getByLabel('New zone name').fill(n);
    await page.getByLabel('New zone layout').selectOption('spread');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByTestId(`row-${n}`)).toHaveCount(1);
  }
  await page.keyboard.press('Escape');
}

async function fill(page: Page, zone: string, n: number) {
  await page.getByTestId('pile-Standard 52').click();
  await page.getByRole('button', { name: 'Draw…' }).click();
  await page.locator('#dcount').fill(String(n));
  await page.locator('#dto').selectOption({ label: zone });
  await page.getByRole('button', { name: `Draw ${n}` }).click();
  await expect(page.getByTestId(`row-${zone}`).locator('[data-h]')).toHaveCount(n);
}

async function scrollingTable(page: Page, name: string) {
  await createTable(page, name, { deck: 'builtin-standard-52' });
  await addZones(page, ['P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8']);
  // empty zones are slim bars (zone-arrangement), so give most of them cards; P2 and P6 stay empty
  for (const z of ['P3', 'P4', 'P5', 'P7', 'P8']) await fill(page, z, 3);
  await page.locator('.board').evaluate((b) => (b.scrollTop = 0));
  const board = page.locator('.board');
  await expect.poll(() => board.evaluate((b) => b.scrollHeight - b.clientHeight)).toBeGreaterThan(300);
  return board;
}

const scrollTop = (page: Page) => page.locator('.board').evaluate((b) => Math.round(b.scrollTop));
const center = async (page: Page, selector: string) => {
  const b = (await page.locator(selector).first().boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
const swipe = (from: Pt, dy: number, steps = 10): Pt[] => Array.from({ length: steps + 1 }, (_, i) => ({ x: from.x, y: from.y + (dy * i) / steps }));

test('one finger on an empty zone or a zone label scrolls the board (1.1)', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex', PHONE);
  await scrollingTable(page, 'Scroll one');
  expect(await scrollTop(page)).toBe(0);
  // swipe up starting on the "Empty" text of zone P2
  await touchPath(page, swipe(await center(page, '[data-testid="row-P2"] .row-empty'), -220));
  await expect.poll(() => scrollTop(page)).toBeGreaterThan(100);
  const after = await scrollTop(page);
  // swipe starting on a zone label: scrolls, and no actions sheet opens
  const label = page.getByRole('button', { name: 'P4 actions' });
  await label.scrollIntoViewIfNeeded();
  const before = await scrollTop(page);
  const lb = (await label.boundingBox())!;
  await touchPath(page, swipe({ x: lb.x + lb.width / 2, y: lb.y + lb.height / 2 }, -150));
  await expect.poll(() => scrollTop(page)).toBeGreaterThan(before + 50);
  await page.waitForTimeout(300);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(after).toBeGreaterThan(100);
  await ctx.close();
});

test('one finger on a card scrubs and does not scroll (1.2)', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex', PHONE);
  await scrollingTable(page, 'Scroll scrub');
  // 8 face-up cards into the Table row
  await page.getByTestId('pile-Standard 52').click();
  await page.getByRole('button', { name: 'Draw…' }).click();
  await page.locator('#dcount').fill('8');
  await page.locator('#dto').selectOption({ label: 'Table' });
  await page.getByRole('button', { name: 'Draw 8' }).click();
  const row = page.getByTestId('row-Table');
  await expect(row.locator('[data-h]')).toHaveCount(8);
  await row.scrollIntoViewIfNeeded();
  const before = await scrollTop(page);
  const first = (await row.locator('[data-h]').first().boundingBox())!;
  const y = first.y + first.height / 2;
  const x0 = first.x + 8;
  // sideways with a slight vertical wobble: a scrub, never a scroll
  await touchPath(page, Array.from({ length: 12 }, (_, i) => ({ x: x0 + i * 14, y: y + (i % 2 ? 3 : -3) })));
  await page.waitForTimeout(300);
  expect(await scrollTop(page)).toBe(before);
  await expect(row.locator('[data-h]')).toHaveCount(8);
  await ctx.close();
});

test('two fingers over cards scroll the board without moving or selecting cards (2.2)', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex', PHONE);
  await scrollingTable(page, 'Scroll two');
  // put cards in P2 so both fingers land on cards
  await page.getByTestId('pile-Standard 52').click();
  await page.getByRole('button', { name: 'Draw…' }).click();
  await page.locator('#dcount').fill('6');
  await page.locator('#dto').selectOption({ label: 'P2' });
  await page.getByRole('button', { name: 'Draw 6' }).click();
  const row = page.getByTestId('row-P2');
  await expect(row.locator('[data-h]')).toHaveCount(6);
  await page.getByRole('button', { name: 'Log', exact: true }).click();
  const logCount = await page.getByLabel('Table log').locator('li').count();
  await page.getByRole('button', { name: 'Log', exact: true }).click();
  const before = await scrollTop(page);
  const cards = row.locator('[data-h]');
  const a = (await cards.nth(0).boundingBox())!;
  const b = (await cards.nth(4).boundingBox())!;
  const p1 = { x: a.x + 10, y: a.y + a.height / 2 };
  const p2 = { x: b.x + b.width - 10, y: b.y + b.height / 2 };
  const cdp = await page.context().newCDPSession(page);
  const send = (type: string, pts: Pt[]) => cdp.send('Input.dispatchTouchEvent', { type: type as any, touchPoints: pts.map((p, i) => ({ ...p, id: i })) });
  await send('touchStart', [p1]);
  await page.waitForTimeout(60);
  await send('touchStart', [p1, p2]);
  for (let i = 1; i <= 12; i++) {
    await page.waitForTimeout(16);
    await send('touchMove', [
      { x: p1.x, y: p1.y - i * 18 },
      { x: p2.x, y: p2.y - i * 18 },
    ]);
  }
  await send('touchEnd', []);
  await expect.poll(() => scrollTop(page)).toBeGreaterThan(before + 150);
  await page.waitForTimeout(600); // glide settles
  // nothing moved, nothing selected, nothing logged, no drag ghost or sheet left behind
  await expect(row.locator('[data-h]')).toHaveCount(6);
  await expect(page.locator('.card.selected')).toHaveCount(0);
  await expect(page.locator('.drag-ghost')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Log', exact: true }).click();
  await expect(page.getByLabel('Table log').locator('li')).toHaveCount(logCount);
  await ctx.close();
});

async function handCard(page: Page) {
  await page.getByTestId('pile-Standard 52').click();
  await page.getByRole('button', { name: 'Draw 1', exact: true }).click();
  const card = page.getByTestId('row-hand').locator('[data-h]').first();
  await expect(card).toHaveCount(1);
  await page.waitForTimeout(400); // deal animation settles
  const b = (await card.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

test('holding a dragged card at the bottom edge scrolls to an off-screen zone; dropping lands there (3.1)', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex', PHONE);
  await scrollingTable(page, 'Scroll drag');
  const start = await handCard(page);
  const board = (await page.locator('.board').boundingBox())!;
  const hold = { x: board.x + board.width / 2, y: board.y + board.height - 14 };
  // pick up the hand card and bring it into the bottom band, then hold there
  const lift = Array.from({ length: 8 }, (_, i) => ({ x: start.x + ((hold.x - start.x) * i) / 7, y: start.y + ((hold.y - start.y) * i) / 7 }));
  const cdp = await touchPath(page, lift, { release: false });
  const p6 = page.getByTestId('row-P6');
  const visibleInBoard = async () => {
    const r = (await p6.boundingBox())!;
    return r.y + r.height / 2 < board.y + board.height - 60;
  };
  for (let i = 0; i < 80 && !(await visibleInBoard()); i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: hold.x + (i % 2), y: hold.y }] });
    await page.waitForTimeout(50);
  }
  expect(await visibleInBoard()).toBe(true);
  expect(await scrollTop(page)).toBeGreaterThan(100);
  // move onto P6 and drop; re-aim each step (the board may still be scrolling, and P6 opens when hovered)
  let at = hold;
  for (let i = 1; i <= 8; i++) {
    const r = (await p6.boundingBox())!;
    const target = { x: r.x + r.width / 2, y: r.y + Math.min(r.height / 2, 30) };
    const k = Math.min(1, i / 4);
    at = { x: at.x + (target.x - at.x) * k, y: at.y + (target.y - at.y) * k };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at] });
    await page.waitForTimeout(60);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(p6.locator('[data-h]')).toHaveCount(1);
  await expect(page.getByTestId('row-hand').locator('[data-h]')).toHaveCount(0);
  await ctx.close();
});

test('a quick drag through the bottom band to a visible zone does not scroll (3.1)', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex', PHONE);
  await scrollingTable(page, 'Scroll pass');
  const start = await handCard(page);
  const row = page.getByTestId('row-Table');
  const r = (await row.boundingBox())!;
  const target = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  const path = Array.from({ length: 8 }, (_, i) => ({ x: start.x + ((target.x - start.x) * i) / 7, y: start.y + ((target.y - start.y) * i) / 7 }));
  await touchPath(page, path, { stepMs: 20 });
  await expect(row.locator('[data-h]')).toHaveCount(1);
  expect(await scrollTop(page)).toBe(0);
  await ctx.close();
});
