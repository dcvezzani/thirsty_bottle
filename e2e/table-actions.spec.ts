import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import fs from 'node:fs';
import { newPlayer, createTable, joinTable, draw, onboard, PHONE } from './helpers';
import { makeDeck, stripCenters, touchPath, line, settle, handles, expectToast } from './table-helpers';

const names = (page: Page, testId: string) => page.getByTestId(testId).locator('[data-h]').evaluateAll((e) => e.map((x) => x.getAttribute('aria-label')));

async function selectHandCard(page: Page, i: number) {
  const pts = await stripCenters(page, 'row-hand');
  await page.touchscreen.tap(pts[i].x, pts[i].y);
}

test('action sheet: pass and show with correct faces; recent destinations and Send again (9.7)', async ({ browser }) => {
  const { ctx: c1, page: alex } = await newPlayer(browser, 'Alex', PHONE);
  await createTable(alex, 'Actions', { deck: 'builtin-standard-52' });
  const { ctx: c2, page: sam } = await newPlayer(browser, 'Sam', PHONE);
  await joinTable(sam, 'Actions');
  const { ctx: c3, page: kim } = await newPlayer(browser, 'Kim', PHONE);
  await joinTable(kim, 'Actions');
  await draw(alex, 'Standard 52', 5);
  const mine = await names(alex, 'row-hand');

  // pass one card to Sam via the action sheet
  await selectHandCard(alex, 0);
  await alex.getByRole('button', { name: 'Actions…' }).click();
  await alex.getByRole('button', { name: 'Pass to Sam' }).click();
  await expect(sam.getByTestId('row-hand').locator('[data-h]')).toHaveCount(1);
  await expect.poll(() => names(sam, 'row-hand')).toEqual([mine[0]]);
  await expect(kim.getByTestId('seat-Sam')).toContainText('1');
  await expect(kim.getByTestId('seat-Sam').locator('[data-h]')).toHaveCount(0);

  // show a card to Sam only
  await selectHandCard(alex, 0);
  await alex.getByRole('button', { name: 'Actions…' }).click();
  await alex.getByRole('button', { name: 'Show to…' }).click();
  await alex.getByRole('dialog').getByRole('button', { name: 'Sam' }).click();
  await expect(sam.getByTestId('seat-Alex').locator('[data-h]')).toHaveCount(1);
  await expect(sam.getByTestId('seat-Alex').locator('[data-h]')).toHaveAttribute('aria-label', mine[1]!);
  await expect(kim.getByTestId('seat-Alex').locator('[data-h]')).toHaveCount(0);
  await sam.getByRole('button', { name: 'Log', exact: true }).click();
  await expect(sam.getByLabel('Table log').locator('li').first()).toContainText(`Alex showed you ${mine[1]}`);
  await kim.getByRole('button', { name: 'Log', exact: true }).click();
  await expect(kim.getByLabel('Table log').locator('li').first()).toContainText('Alex showed 1 card to Sam');

  // Move to… Discard (face up from hand), then Send again
  await selectHandCard(alex, 1);
  await alex.getByRole('button', { name: 'Actions…' }).click();
  await alex.getByRole('button', { name: 'Move to…' }).click();
  await alex.getByRole('dialog').getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(alex.getByTestId('pile-Discard').locator('[data-h]')).toHaveAttribute('aria-label', mine[2]!);
  await selectHandCard(alex, 1);
  await alex.getByRole('button', { name: /Send again → Discard/ }).click();
  await expect(alex.getByTestId('pile-Discard').locator('[data-h]')).toHaveAttribute('aria-label', mine[3]!);
  await expect(kim.getByTestId('pile-Discard').locator('[data-h]')).toHaveAttribute('aria-label', mine[3]!);
  // recent destinations come first in Move to…
  await selectHandCard(alex, 0);
  await alex.getByRole('button', { name: 'Actions…' }).click();
  await alex.getByRole('button', { name: 'Move to…' }).click();
  await expect(alex.getByRole('dialog').getByText('Recent')).toBeVisible();
  await expect(alex.getByRole('dialog').locator('button.primary').first()).toHaveText('Discard');
  await Promise.all([c1.close(), c2.close(), c3.close()]);
});

async function slowServerMessages(ctx: BrowserContext, delay: { ms: number }) {
  await ctx.routeWebSocket(/\/ws$/, (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((m) => server.send(m));
    server.onMessage((m) => {
      if (delay.ms) setTimeout(() => ws.send(m), delay.ms);
      else ws.send(m);
    });
  });
}

test('optimistic moves, rejected drag animates back, live drag preview; frame timing (9.8)', async ({ browser }) => {
  const delay = { ms: 0 };
  const c1 = await browser.newContext(PHONE);
  await slowServerMessages(c1, delay);
  const alex = await c1.newPage();
  await onboard(alex, 'Alex');
  const deck = await makeDeck(alex, 'Tiny', [
    { name: 'Alpha', count: 1 },
    { name: 'Beta', count: 1 },
    { name: 'Gamma', count: 1 },
  ]);
  await alex.goto('/');
  await createTable(alex, 'Optimistic', { deck });
  const { ctx: c2, page: sam } = await newPlayer(browser, 'Sam', PHONE);
  await joinTable(sam, 'Optimistic');
  await draw(alex, 'Tiny', 2);
  await expect(alex.getByTestId('row-hand').locator('[data-h]')).toHaveCount(2);

  // with a slow network, my own move shows immediately (before the server answers)
  delay.ms = 800;
  await selectHandCard(alex, 0);
  await alex.getByRole('button', { name: 'Actions…' }).click();
  const t0 = Date.now();
  await alex.getByRole('button', { name: 'Play to Table' }).click();
  await expect(alex.getByTestId('row-Table').locator('[data-h]')).toHaveCount(1, { timeout: 300 });
  expect(Date.now() - t0).toBeLessThan(500);
  await expect(sam.getByTestId('row-Table').locator('[data-h]')).toHaveCount(1);
  await alex.waitForTimeout(900);

  // rejected: Alex drags the last pile card while Sam draws it first → it goes back
  const pile = (await alex.getByTestId('pile-Tiny').boundingBox())!;
  const table = (await alex.getByTestId('row-Table').boundingBox())!;
  const start = { x: pile.x + pile.width / 2, y: pile.y + pile.height / 2 };
  const cdp = await touchPath(alex, [start, ...line(start, { x: table.x + table.width / 2, y: table.y + table.height / 2 }, 10)], { release: false });
  await expect(alex.locator('.drag-ghost .card')).toBeVisible();
  await expect(sam.getByTestId('other-drag')).toBeVisible(); // live preview of Alex's drag
  await sam.getByTestId('pile-Tiny').click();
  await sam.getByRole('button', { name: 'Draw 1', exact: true }).click();
  await expect(sam.getByTestId('row-hand').locator('[data-h]')).toHaveCount(1);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  // optimistic: briefly in Table, then reverted when the server refuses
  await expect(alex.getByTestId('row-Table').locator('[data-h]')).toHaveCount(2, { timeout: 400 });
  await expectToast(alex, /moved|no longer/);
  await expect(alex.getByTestId('row-Table').locator('[data-h]')).toHaveCount(1);
  delay.ms = 0;

  // frame timing while scrubbing a 30-card hand with the CPU throttled 4×
  const page = alex;
  await page.getByTestId('Optimistic'); // noop
  await Promise.all([c2.close()]);
  const { ctx: c3, page: p } = await newPlayer(browser, 'Perf', PHONE);
  await createTable(p, 'Perf', { deck: 'builtin-standard-52' });
  await draw(p, 'Standard 52', 30);
  await expect(p.getByTestId('row-hand').locator('[data-h]')).toHaveCount(30);
  const pts = await stripCenters(p, 'row-hand');
  const cdp2 = await c3.newCDPSession(p);
  await cdp2.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await p.evaluate(() => {
    (window as any).__frames = [];
    const loop = (t: number) => {
      (window as any).__frames.push(t);
      if ((window as any).__frames.length < 2000) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  const path = [...pts, ...pts.slice().reverse(), ...pts];
  await touchPath(p, path, { stepMs: 12 });
  const frames: number[] = await p.evaluate(() => (window as any).__frames);
  const dts = frames.slice(1).map((t, i) => t - frames[i]).sort((a, b) => a - b);
  const p50 = dts[Math.floor(dts.length * 0.5)];
  const p95 = dts[Math.floor(dts.length * 0.95)];
  fs.mkdirSync('test-results', { recursive: true });
  fs.writeFileSync('test-results/frame-timing.json', JSON.stringify({ cpuThrottle: 4, frames: dts.length, p50, p95, fps50: 1000 / p50 }, null, 2));
  console.log(`scrub frame timing (4× CPU throttle): p50 ${p50.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms`);
  expect(p50).toBeLessThan(20); // ~60fps median
  expect(p95).toBeLessThan(50);
  await cdp2.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await Promise.all([c1.close(), c3.close()]);
});

test('card info: hidden cards reveal nothing; face-up copies show distinct copy numbers in info and log (9.9)', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex', PHONE);
  const deck = await makeDeck(page, 'Monsters', [
    { name: 'Goblin', count: 3, metadata: { power: 1 } },
    { name: 'Orc', count: 1 },
  ]);
  await page.goto('/');
  await createTable(page, 'Info', { deck });
  // long-press the face-down pile top
  const pile = (await page.getByTestId('pile-Monsters').boundingBox())!;
  await touchPath(page, [{ x: pile.x + pile.width / 2, y: pile.y + pile.height / 2 }], { holdMs: 650 });
  const dlg = page.getByRole('dialog');
  await expect(dlg).toHaveAccessibleName('Face-down card');
  await expect(dlg.getByTestId('hidden-info')).toHaveText('Monsters, card 1 of 4');
  await expect(dlg).not.toContainText('Goblin');
  await expect(dlg).not.toContainText('Copy');
  await page.keyboard.press('Escape');
  // two Goblins face up onto the Table
  for (let i = 0; i < 2; i++) {
    await page.getByTestId('pile-Monsters').click();
    await page.getByRole('button', { name: 'Draw…' }).click();
    await page.locator('#dto').selectOption({ label: 'Table' });
    await page.getByRole('button', { name: 'Draw 1' }).click();
  }
  await page.getByRole('button', { name: 'Table actions' }).click();
  await page.getByRole('button', { name: 'Flip all' }).click();
  await expect(page.getByTestId('row-Table').getByTestId('copy-badge')).toHaveCount(2);
  const pts = await stripCenters(page, 'row-Table');
  const copies: string[] = [];
  for (const p of pts) {
    await touchPath(page, [p], { holdMs: 650 });
    copies.push(await page.getByRole('dialog').getByTestId('copy-of').innerText());
    await expect(page.getByRole('dialog').getByTestId('card-info')).toContainText('power');
    await page.keyboard.press('Escape');
  }
  expect(copies.sort()).toEqual(['Copy 1 of 3', 'Copy 2 of 3']);
  // log names the copies once public: move each to Discard face up
  for (let i = 0; i < 2; i++) {
    const p = (await stripCenters(page, 'row-Table'))[0];
    await page.touchscreen.tap(p.x, p.y);
    await page.getByRole('button', { name: 'Actions…' }).click();
    await page.getByRole('button', { name: 'Move to…' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Discard', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Log', exact: true }).click();
  const log = await page.getByLabel('Table log').locator('li').allInnerTexts();
  expect(log.some((t) => t.includes('Goblin #1'))).toBe(true);
  expect(log.some((t) => t.includes('Goblin #2'))).toBe(true);
  await ctx.close();
});

test('drawer, counters, mode switch mid-game, out-of-turn refusal, host menus (9.10)', async ({ browser }) => {
  const { ctx: c1, page: alex } = await newPlayer(browser, 'Alex', PHONE);
  await createTable(alex, 'Turns', { deck: 'builtin-standard-52' });
  const c2ctx = await browser.newContext(PHONE);
  await c2ctx.addInitScript(() => {
    (window as any).__vib = [];
    Object.defineProperty(navigator, 'vibrate', { value: (ms: number) => ((window as any).__vib.push(ms), true), configurable: true });
  });
  const sam = await c2ctx.newPage();
  await onboard(sam, 'Sam');
  await joinTable(sam, 'Turns');
  await draw(sam, 'Standard 52', 2);
  // switch to turn-based mid-game
  await alex.getByTestId('mode-chip').click();
  await expect(sam.getByTestId('turn-bar')).toHaveText(/Alex's turn/);
  await sam.getByTestId('pile-Standard 52').click();
  await sam.getByRole('button', { name: 'Draw 1', exact: true }).click();
  await expectToast(sam, "It's Alex's turn");
  await expect(sam.getByTestId('row-hand').locator('[data-h]')).toHaveCount(2);
  // own-hand reorder still allowed out of turn
  const before = await handles(sam, 'row-hand');
  const pts = await stripCenters(sam, 'row-hand');
  await touchPath(sam, [pts[0], { x: pts[0].x, y: pts[0].y - 15 }, ...line({ x: pts[0].x, y: pts[0].y - 15 }, { x: Math.min(370, pts[1].x + 40), y: pts[1].y - 10 }, 6)]);
  await expect.poll(async () => (await handles(sam, 'row-hand'))[1]).toBe(before[0]);
  // end turn → Sam's turn with notice + vibration
  await alex.getByRole('button', { name: 'End turn' }).click();
  await expect(sam.getByTestId('turn-bar')).toHaveText(/Your turn/);
  await expectToast(sam, 'Your turn');
  expect(await sam.evaluate(() => (window as any).__vib.length)).toBeGreaterThan(0);
  // back to real-time: everyone can act
  await alex.getByTestId('mode-chip').click();
  await expect(alex.getByTestId('turn-bar')).toHaveCount(0);
  await sam.getByTestId('pile-Standard 52').click();
  await sam.getByRole('button', { name: 'Draw 1', exact: true }).click();
  await expect(sam.getByTestId('row-hand').locator('[data-h]')).toHaveCount(3);
  // counters
  await alex.getByRole('button', { name: '+ Counter' }).click();
  await alex.getByLabel('New counter').fill('Alex score');
  await alex.getByRole('button', { name: 'Add', exact: true }).click();
  await alex.getByRole('button', { name: 'Increase Alex score' }).click();
  await alex.getByRole('button', { name: 'Increase Alex score' }).click();
  await expect(sam.getByTestId('counter-Alex score')).toHaveText('2');
  // drawer tabs
  for (const tab of ['Room', 'Lobby', 'Log', 'Info']) {
    await alex.getByRole('button', { name: tab, exact: true }).click();
    await expect(alex.getByRole('region', { name: `${tab.toLowerCase()} panel` })).toBeVisible();
  }
  await alex.getByRole('button', { name: 'Info', exact: true }).click();
  // undo my last action
  await alex.getByRole('button', { name: 'Increase Alex score' }).click();
  await alex.getByRole('button', { name: 'Undo' }).click();
  await expect(sam.getByTestId('counter-Alex score')).toHaveText('2');
  // host menu: make Sam host
  await alex.getByTestId('seat-Sam').click();
  await alex.getByRole('button', { name: 'Make host' }).click();
  await expect(sam.getByTestId('seat-Alex')).not.toContainText('👑');
  await sam.getByRole('button', { name: 'Table settings' }).click();
  await expect(sam.getByLabel('Name', { exact: true })).toBeVisible();
  await Promise.all([c1.close(), c2ctx.close()]);
});

test('action feedback: 4-player deal on a phone shows travelling cards and actor labels (9.11)', async ({ browser }) => {
  const players = await Promise.all(['Alex', 'Sam', 'Kim', 'Lee'].map((n) => newPlayer(browser, n, PHONE)));
  const [alex, ...rest] = players.map((p) => p.page);
  await createTable(alex, 'Deal', { deck: 'builtin-standard-52' });
  for (const p of rest) await joinTable(p, 'Deal');
  const sam = rest[0];
  await expect(sam.locator('.seat')).toHaveCount(3);
  await alex.getByTestId('pile-Standard 52').click();
  await alex.getByRole('button', { name: 'Shuffle' }).click();
  await alex.getByTestId('pile-Standard 52').click();
  await alex.getByRole('button', { name: 'Deal…' }).click();
  await alex.locator('#dealn').fill('5');
  const shots: string[] = [];
  fs.mkdirSync('test-results/deal', { recursive: true });
  const seenGhosts = sam.waitForSelector('.anim-ghost', { timeout: 3000 });
  const seenLabel = sam.waitForSelector('.actor-float', { timeout: 3000 });
  await alex.getByRole('button', { name: /^Deal 5 to 4 seats$/ }).click();
  await seenGhosts;
  await seenLabel;
  for (let i = 0; i < 6; i++) {
    const f = `test-results/deal/frame-${i}.png`;
    await sam.screenshot({ path: f });
    shots.push(f);
    await sam.waitForTimeout(90);
  }
  await expect(sam.getByTestId('row-hand').locator('[data-h]')).toHaveCount(5);
  await expect(sam.getByTestId('seat-Kim')).toContainText('5');
  await settle(sam);
  await Promise.all(players.map((p) => p.ctx.close()));
});
