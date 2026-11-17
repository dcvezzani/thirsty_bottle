import { test, expect, type Page } from '@playwright/test';
import { newPlayer, createTable, joinTable, PHONE } from './helpers';
import { stripCenters, settle } from './table-helpers';

const NAMES = ['Alex', 'Sam', 'Kim', 'Lee'];

async function selectHand(page: Page, idx: number[]) {
  for (const i of idx) {
    const pts = await stripCenters(page, 'row-hand');
    await page.touchscreen.tap(pts[i].x, pts[i].y);
  }
}

async function passTo(page: Page, idx: number[], to: string) {
  await selectHand(page, idx);
  await expect(page.getByTestId('selection-count')).toHaveText(`${idx.length} selected`);
  await page.getByRole('button', { name: 'Actions…' }).click();
  await page.getByRole('button', { name: `Pass to ${to}` }).click();
}

async function playToTable(page: Page, i = 0) {
  await selectHand(page, [i]);
  try {
    await page.getByRole('button', { name: 'Actions…' }).click({ timeout: 8000 });
    await page.getByRole('button', { name: 'Play to Table' }).click({ timeout: 8000 });
  } catch (e) {
    const pts = await stripCenters(page, 'row-hand');
    const info = await page.evaluate((p) => {
      const el = document.elementFromPoint(p.x, p.y) as HTMLElement | null;
      return { at: el?.className + ' ' + el?.closest('[data-testid]')?.getAttribute('data-testid'), sel: document.querySelectorAll('.card.selected').length, ui: (window as any).__ui };
    }, pts[i]);
    console.log('stuck', JSON.stringify(info), JSON.stringify(pts[i]));
    throw e;
  }
}

/** Every client's view must agree on public state and total card count. */
async function snapshotView(page: Page) {
  await settle(page);
  return page.evaluate(() => {
    const txt = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)].map((e) => e.getAttribute('aria-label'));
    const seats = Object.fromEntries([...document.querySelectorAll<HTMLElement>('.seat')].map((s) => [s.querySelector('.seat-name')!.textContent!.replace('👑 ', ''), Number(s.querySelector('.seat-count')!.textContent)]));
    return {
      table: txt('[data-testid="row-Table"] [data-h]'),
      discard: txt('[data-testid="pile-Discard"] [data-h]'),
      deckCount: document.querySelectorAll('[data-testid="pile-Standard 52"] .pile-count')[0]?.textContent,
      hand: document.querySelectorAll('[data-testid="row-hand"] [data-h]').length,
      seats,
      counters: [...document.querySelectorAll<HTMLElement>('[data-testid^="counter-"]')].map((c) => `${c.dataset.testid}=${c.textContent}`),
      mode: document.querySelector('[data-testid="mode-chip"]')?.textContent,
    };
  });
}

test('4-player Hearts in turn-based mode, switching to real-time mid-hand; hidden-information audit (10.1, 10.2)', async ({ browser }) => {
  test.setTimeout(180_000);
  const players = [];
  for (const n of NAMES) players.push(await newPlayer(browser, n, PHONE));
  const pages = players.map((p) => p.page);
  const [alex, sam, kim, lee] = pages;

  // 10.2: capture every WebSocket frame Sam receives
  const frames: string[] = [];
  sam.on('websocket', (ws) => ws.on('framereceived', (f) => typeof f.payload === 'string' && frames.push(f.payload)));
  await sam.reload();
  await expect(sam.getByRole('button', { name: '+ New table' })).toBeVisible();

  await createTable(alex, 'Hearts 4p', { deck: 'builtin-standard-52', seats: '4' });
  for (const p of [sam, kim, lee]) await joinTable(p, 'Hearts 4p');
  await expect(alex.locator('.seat')).toHaveCount(3);

  // shuffle and deal 13 each
  await alex.getByTestId('pile-Standard 52').click();
  await alex.getByRole('button', { name: 'Shuffle' }).click();
  await alex.getByTestId('pile-Standard 52').click();
  await alex.getByRole('button', { name: 'Deal…' }).click();
  await alex.locator('#dealn').fill('13');
  await alex.getByRole('button', { name: 'Deal 13 to 4 seats' }).click();
  for (const p of pages) await expect(p.getByTestId('row-hand').locator('[data-h]')).toHaveCount(13);

  // pass 3 cards to the left
  for (let i = 0; i < 4; i++) await passTo(pages[i], [0, 1, 2], NAMES[(i + 1) % 4]);
  for (const p of pages) await expect(p.getByTestId('row-hand').locator('[data-h]')).toHaveCount(13);

  // scores
  await alex.getByRole('button', { name: '+ Counter' }).click();
  for (const n of NAMES) {
    await alex.getByLabel('New counter').fill(`${n} score`);
    await alex.getByRole('button', { name: 'Add', exact: true }).click();
  }

  // turn-based: two tricks, each player plays when it's their turn
  await alex.getByTestId('mode-chip').click();
  for (const p of pages) await expect(p.getByTestId('turn-bar')).toBeVisible();
  for (let trick = 0; trick < 2; trick++) {
    for (let i = 0; i < 4; i++) {
      const p = pages[i];
      await expect(p.getByTestId('turn-bar')).toHaveText(/Your turn/);
      // someone out of turn is refused
      if (i === 0) {
        await sam.getByTestId('pile-Discard').click();
        await sam.getByRole('button', { name: 'Gather all here' }).click();
        await expect(sam.locator('.toast').filter({ hasText: "It's Alex's turn" }).last()).toBeVisible();
      }
      await playToTable(p, 0);
      await expect(alex.getByTestId('row-Table').locator('[data-h]')).toHaveCount(i + 1);
      await p.getByRole('button', { name: 'End turn' }).click();
    }
    // trick winner (Alex, for the test) takes the trick to the discard pile and scores it
    await expect(alex.getByTestId('turn-bar')).toHaveText(/Your turn/);
    await alex.getByRole('button', { name: 'Table actions' }).click();
    await alex.getByRole('button', { name: 'Select all' }).click();
    await alex.getByRole('button', { name: 'Actions…' }).click();
    await alex.getByRole('button', { name: 'Move to…' }).click();
    await alex.getByRole('dialog').getByRole('button', { name: 'Discard', exact: true }).click();
    await expect(alex.getByTestId('row-Table').locator('[data-h]')).toHaveCount(0);
    await alex.getByRole('button', { name: 'Increase Alex score' }).click();
  }

  // switch to real-time mid-hand: everyone plays at once
  await alex.getByTestId('mode-chip').click();
  for (const p of pages) await expect(p.getByTestId('turn-bar')).toHaveCount(0);
  await Promise.all(pages.map((p) => playToTable(p, 0)));
  for (const p of pages) await expect(p.getByTestId('row-Table').locator('[data-h]')).toHaveCount(4);

  // consistency: all clients agree
  const views = [];
  for (const p of pages) views.push(await snapshotView(p));
  for (const v of views) {
    expect(v.table.slice().sort()).toEqual(views[0].table.slice().sort());
    expect(v.discard).toEqual(views[0].discard);
    expect(v.counters).toEqual(views[0].counters);
    expect(v.mode).toBe('Real-time');
    expect(v.hand).toBe(10);
    expect(Object.values(v.seats)).toEqual([10, 10, 10]);
  }
  expect(views[0].counters).toContain('counter-Alex score=2');
  expect(views[0].table.every((n) => n !== 'Face-down card')).toBe(true);

  // 10.2: audit Sam's frames: other players' hands never carry identities; face-down shared cards neither
  let checkedCards = 0;
  let mySeat: string | null = null;
  for (const raw of frames) {
    const m = JSON.parse(raw);
    if (m.t === 'table.snapshot') mySeat = m.table.me.seatId;
    const zones = m.t === 'table.snapshot' ? m.table.zones : m.t === 'table.patch' ? (m.patch.zones ?? []) : [];
    for (const z of zones) {
      for (const c of z.cards) {
        checkedCards++;
        const hidden = (z.kind === 'hand' && z.seatId !== mySeat) || (z.kind === 'shared' && !c.faceUp);
        if (hidden && !c.shownBy && !c.peeked) {
          expect(c.known, JSON.stringify({ z: z.name, c })).toBe(false);
          expect(c.def).toBeUndefined();
          expect(c.copyNo).toBeUndefined();
        }
      }
    }
    // passes between other players never name the cards in what Sam receives
    if (m.t === 'table.patch' && m.patch.log)
      for (const e of m.patch.log) if (/passed/.test(e.text) && !/^You passed|passed you/.test(e.text)) expect(e.text).toMatch(/passed \d+ cards? to/);
  }
  expect(checkedCards).toBeGreaterThan(300); // the audit really inspected the game's frames
  await Promise.all(players.map((p) => p.ctx.close()));
});
