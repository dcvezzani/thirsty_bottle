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

// unique table names, so repeated runs against one server never join an older table
let last = '';
const uniq = (n: string) => (last = `${n} ${Date.now() % 100000}`);

const zoneOrder = (page: Page) => page.locator('.board section.zone').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
const noSideways = (page: Page) =>
  page.evaluate(() => {
    const b = document.querySelector('.board')!;
    return document.documentElement.scrollWidth <= innerWidth && b.scrollWidth <= b.clientWidth;
  });

test('zones appear in the server order on a phone and a desktop, without sideways scrolling (2.2)', async ({ browser }) => {
  const { ctx: c1, page: phone } = await newPlayer(browser, 'Alex', PHONE);
  await createTable(phone, uniq('Flow order'), { deck: 'builtin-standard-52' });
  await addZones(phone, [
    ['A', 'pile'],
    ['B', 'spread'],
    ['C', 'pile'],
  ]);
  const { ctx: c2, page: desk } = await newPlayer(browser, 'Sam', { viewport: { width: 1280, height: 800 } });
  await joinTable(desk, last);
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

test('zone sheet: Move earlier swaps zones for everyone; width reflows; non-hosts see no arrange controls (4.1)', async ({ browser }) => {
  const { ctx: c1, page: alex } = await newPlayer(browser, 'Alex', PHONE);
  await createTable(alex, uniq('Sheet arrange'), { deck: 'builtin-standard-52' });
  await addZones(alex, [
    ['P1', 'column'],
    ['P2', 'column'],
    ['P3', 'column'],
  ]);
  const { ctx: c2, page: sam } = await newPlayer(browser, 'Sam', PHONE);
  await joinTable(sam, last);
  const tail = async (p: Page) => (await zoneOrder(p)).slice(-3);
  await expect.poll(() => tail(sam)).toEqual(['P1', 'P2', 'P3']);
  await alex.getByRole('button', { name: 'P3 actions' }).click();
  await alex.getByRole('button', { name: 'Move earlier' }).click();
  await expect.poll(() => tail(alex)).toEqual(['P1', 'P3', 'P2']);
  await expect.poll(() => tail(sam)).toEqual(['P1', 'P3', 'P2']);
  // width: P3 Full takes the whole row; Fit puts it back beside the others
  const width = (p: Page, n: string) => p.locator(`section.zone[aria-label="${n}"]`).evaluate((e) => e.getBoundingClientRect().width);
  const boardW = await alex.locator('.board').evaluate((b) => b.clientWidth - 12);
  await alex.getByRole('group', { name: 'Width' }).getByRole('button', { name: 'Full' }).click();
  await expect.poll(() => width(sam, 'P3')).toBeGreaterThan(boardW - 2);
  await alex.getByRole('group', { name: 'Width' }).getByRole('button', { name: 'Fit' }).click();
  await expect.poll(() => width(sam, 'P3')).toBeLessThan(120);
  // start a new row
  const top = (p: Page, n: string) => p.locator(`section.zone[aria-label="${n}"]`).evaluate((e) => Math.round(e.getBoundingClientRect().top));
  expect(await top(sam, 'P3')).toBe(await top(sam, 'P1'));
  await alex.getByLabel('Start a new row').click();
  await expect(alex.getByLabel('Start a new row')).toBeChecked();
  await expect.poll(async () => (await top(sam, 'P3')) > (await top(sam, 'P1'))).toBe(true);
  await alex.keyboard.press('Escape');
  // a non-host's zone sheet has no arrange controls
  await sam.getByRole('button', { name: 'P2 actions' }).click();
  await expect(sam.getByRole('dialog')).toBeVisible();
  await expect(sam.getByRole('button', { name: 'Move earlier' })).toHaveCount(0);
  await expect(sam.getByRole('group', { name: 'Width' })).toHaveCount(0);
  await Promise.all([c1.close(), c2.close()]);
});

async function touchHold(page: Page, p: { x: number; y: number }, ms: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
  await page.waitForTimeout(ms);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
const centerOf = async (page: Page, sel: string) => {
  const b = (await page.locator(sel).first().boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

test('arrange mode: drag a tile for everyone, cards locked, edge scroll, host handover closes it, long press is host-only (4.2)', async ({ browser }) => {
  const { ctx: c1, page: alex } = await newPlayer(browser, 'Alex', PHONE);
  await createTable(alex, uniq('Arrange'), { deck: 'builtin-standard-52' });
  await addZones(alex, [
    ['S1', 'spread'],
    ['S2', 'spread'],
    ['S3', 'spread'],
    ['S4', 'spread'],
    ['S5', 'spread'],
    ['Last', 'pile'],
  ]);
  const { ctx: c2, page: sam } = await newPlayer(browser, 'Sam', PHONE);
  await joinTable(sam, last);
  await expect.poll(async () => (await zoneOrder(sam)).at(-1)).toBe('Last');

  // a non-host's long press on a label does not open arrange mode
  await touchHold(sam, await centerOf(sam, 'button[aria-label="Table actions"]'), 700);
  await expect(sam.getByRole('region', { name: 'Arranging zones' })).toHaveCount(0);
  await sam.keyboard.press('Escape');

  // the host enters by long-pressing a label; no zone sheet opens
  await touchHold(alex, await centerOf(alex, 'button[aria-label="Table actions"]'), 700);
  await expect(alex.getByRole('region', { name: 'Arranging zones' })).toBeVisible();
  await expect(alex.getByRole('dialog')).toHaveCount(0);
  // cards are locked: none are rendered on the board while arranging
  await expect(alex.locator('.board [data-h]')).toHaveCount(0);
  await expect(alex.locator('.arrange-tile')).toHaveCount(9);

  // holding a dragged tile at the bottom edge scrolls the board
  const board = alex.locator('.board');
  await board.evaluate((b) => (b.scrollTop = 0));
  const bb = (await board.boundingBox())!;
  await board.evaluate((b) => (b.scrollTop = b.scrollHeight)); // bring "Last" into view
  const lastGrip = await centerOf(alex, 'button[aria-label="Move Last"]');
  const cdp = await alex.context().newCDPSession(alex);
  const t = (type: string, p?: { x: number; y: number }) => cdp.send('Input.dispatchTouchEvent', { type: type as any, touchPoints: p ? [p] : [] });
  await t('touchStart', lastGrip);
  // to the top band and hold: the board scrolls up toward Discard
  const topBand = { x: bb.x + bb.width / 2, y: bb.y + 12 };
  for (let i = 1; i <= 6; i++) {
    await alex.waitForTimeout(20);
    await t('touchMove', { x: lastGrip.x + ((topBand.x - lastGrip.x) * i) / 6, y: lastGrip.y + ((topBand.y - lastGrip.y) * i) / 6 });
  }
  const scrolledFrom = await board.evaluate((b) => b.scrollTop);
  for (let i = 0; i < 40 && (await board.evaluate((b) => b.scrollTop)) > 0; i++) {
    await t('touchMove', { x: topBand.x + (i % 2), y: topBand.y });
    await alex.waitForTimeout(50);
  }
  expect(await board.evaluate((b) => b.scrollTop)).toBeLessThan(scrolledFrom);
  // drop it just before "Standard 52" (left half of its tile): Last lands right after Discard
  const std = (await alex.locator('section[aria-label="Standard 52 tile"]').boundingBox())!;
  const dropAt = { x: std.x + 8, y: std.y + std.height / 2 };
  for (let i = 1; i <= 4; i++) {
    await alex.waitForTimeout(30);
    await t('touchMove', { x: topBand.x + ((dropAt.x - topBand.x) * i) / 4, y: topBand.y + ((dropAt.y - topBand.y) * i) / 4 });
  }
  await expect(alex.locator('.arrange-tile.placeholder')).toHaveCount(1);
  await t('touchEnd');
  await expect.poll(() => zoneOrder(sam)).toEqual(['Discard', 'Last', 'Standard 52', 'Table', 'S1', 'S2', 'S3', 'S4', 'S5']);

  // width from the tile
  await alex.getByLabel('S1 width').selectOption('half');
  await expect.poll(() => sam.locator('section.zone[aria-label="S1"]').evaluate((e) => e.classList.contains('w-half'))).toBe(true);

  // handing the host role to Sam closes arrange mode for Alex
  await alex.getByTestId('seat-Sam').click();
  await alex.getByRole('button', { name: 'Make host' }).click();
  await expect(alex.getByRole('region', { name: 'Arranging zones' })).toHaveCount(0);
  await expect(alex.locator('.board [data-h]').first()).toBeVisible();
  await Promise.all([c1.close(), c2.close()]);
});

test('arrange mode from Settings; Escape and Done exit (4.2)', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex', PHONE);
  await createTable(page, 'Arrange settings', { deck: 'builtin-standard-52' });
  await page.getByRole('button', { name: 'Table settings' }).click();
  await page.getByRole('button', { name: 'Arrange zones' }).click();
  await expect(page.getByRole('region', { name: 'Arranging zones' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Arranging zones' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Table settings' }).click();
  await page.getByRole('button', { name: 'Arrange zones' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('region', { name: 'Arranging zones' })).toHaveCount(0);
  await ctx.close();
});

test('a Solitaire-style table fits a 375px phone: 13 zones, two rows on the first screen, no sideways scroll (5.1)', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex', PHONE);
  await createTable(page, uniq('Solitaire'), { deck: 'builtin-standard-52' });
  // the deck pile is the stock; remove the default Discard and Table
  for (const n of ['Discard', 'Table']) {
    await page.getByRole('button', { name: `${n} actions` }).click();
    await page.getByRole('button', { name: 'Remove zone' }).click();
    await expect(page.locator(`section.zone[aria-label="${n}"]`)).toHaveCount(0);
  }
  await addZones(page, [
    ['Waste', 'pile'],
    ['F1', 'pile'],
    ['F2', 'pile'],
    ['F3', 'pile'],
    ['F4', 'pile'],
    ...(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'].map((n) => [n, 'column']) as [string, 'column'][]),
  ]);
  await page.getByRole('button', { name: 'P1 actions' }).click();
  await page.getByLabel('Start a new row').click();
  await expect(page.getByLabel('Start a new row')).toBeChecked();
  await page.keyboard.press('Escape');
  await fillZone(page, 'P7', 7);
  await fillZone(page, 'P3', 3);
  const names = ['Standard 52', 'Waste', 'F1', 'F2', 'F3', 'F4', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'];
  expect(await zoneOrder(page)).toEqual(names);
  const rect = (n: string) => page.locator(`section.zone[aria-label="${n}"]`).evaluate((e) => { const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: r.bottom, left: r.left, right: r.right }; });
  const pileTops = await Promise.all(names.slice(0, 6).map(async (n) => (await rect(n)).top));
  const colTops = await Promise.all(names.slice(6).map(async (n) => (await rect(n)).top));
  expect(new Set(pileTops).size).toBe(1); // stock, waste and foundations share a row
  expect(new Set(colTops).size).toBe(1); // all seven columns side by side
  expect(colTops[0]).toBeGreaterThan(pileTops[0]);
  expect(await noSideways(page)).toBe(true);
  const board = (await page.locator('.board').boundingBox())!;
  for (const n of names) {
    const r = await rect(n);
    expect(r.right).toBeLessThanOrEqual(board.x + board.width);
    expect(r.left).toBeGreaterThanOrEqual(board.x);
  }
  // the first screen shows the top of both rows
  expect(colTops[0] + 40).toBeLessThan(board.y + board.height);
  await ctx.close();
});
