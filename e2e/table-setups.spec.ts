import { test, expect, type Page } from '@playwright/test';
import { newPlayer, createTable, joinTable, PHONE } from './helpers';
import { settle } from './table-helpers';

// table-setups e2e

test('setup library: create, edit, discard, save, clone, archive, delete (4.1)', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex', PHONE);
  await page.getByRole('button', { name: 'Setups' }).click();
  await page.getByLabel('New setup name').fill('Quick game');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name: 'Quick game' })).toBeVisible();
  // edit: a zone, then discard
  await page.getByRole('button', { name: '+ Zone' }).click();
  await expect(page.getByLabel('Zone 1 name')).toHaveValue('Zone 1');
  await expect(page.getByTestId('unsaved')).toBeVisible();
  await page.waitForTimeout(500); // the draft autosaves
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(page.getByLabel('Zone 1 name')).toHaveCount(0);
  // edit again and save: a deck slot living in a pile, a column dealing 2 down + 1 up, a per-seat counter
  await page.getByRole('button', { name: '+ Zone' }).click();
  await page.getByLabel('Zone 1 name').fill('Stock');
  await page.getByLabel('Zone 1 layout').selectOption('pile');
  await page.getByRole('button', { name: '+ Zone' }).click();
  await page.getByLabel('Zone 2 name').fill('Row');
  await page.getByLabel('Zone 2 layout').selectOption('column');
  await page.getByLabel('Zone 2 face down').fill('2');
  await page.getByLabel('Zone 2 face up').fill('1');
  await page.getByRole('button', { name: '+ Deck slot' }).click();
  await expect(page.getByLabel('Deck slot 1 home zone')).toHaveValue(/z/);
  await page.getByLabel('Deck slot 1 default deck').selectOption({ label: 'Standard 52' });
  await page.getByRole('button', { name: '+ Counter' }).click();
  await page.getByLabel('Cards in each hand').fill('2:7, 3-4:5');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.toast').filter({ hasText: 'Setup saved' })).toBeVisible();
  await expect(page.getByTestId('unsaved')).toHaveCount(0);
  await expect(page.getByLabel('Zone 2 face down')).toHaveValue('2');
  await expect(page.getByLabel('Cards in each hand')).toHaveValue('2:7, 3-4:5');
  // clone
  await page.getByRole('button', { name: 'Clone' }).click();
  await expect(page.getByRole('heading', { name: 'Quick game (copy)' })).toBeVisible();
  // archive the copy, then delete it from the Archived tab
  await page.getByRole('button', { name: 'Archive' }).click();
  await expect(page.getByRole('heading', { name: 'Setups' })).toBeVisible();
  await expect(page.getByTestId('setup-row')).toHaveCount(1);
  await page.getByRole('tab', { name: /Archived/ }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Delete Quick game (copy) permanently' }).click();
  await expect(page.locator('.toast').filter({ hasText: 'Deleted "Quick game (copy)"' })).toBeVisible();
  await expect(page.getByLabel('Archived setups').getByTestId('setup-row')).toHaveCount(0);
  await ctx.close();
});

const zoneOrder = (page: Page) => page.locator('.board section.zone').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
const faces = (page: Page, zone: string) => page.getByTestId(`row-${zone}`).locator('[data-h]').evaluateAll((e) => e.map((x) => (x.classList.contains('face') ? 'up' : 'down')));
async function addZones(page: Page, zones: [string, string][]) {
  await page.getByRole('button', { name: 'Table settings' }).click();
  for (const [n, layout] of zones) {
    await page.getByLabel('New zone name').fill(n);
    await page.getByLabel('New zone layout').selectOption(layout);
    await page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.locator(`section.zone[aria-label="${n}"]`)).toHaveCount(1);
  }
  await page.keyboard.press('Escape');
}
async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'Table settings' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}
async function applyFromSheet(page: Page, name: string) {
  await openSettings(page);
  await page.getByRole('button', { name: 'Apply setup…' }).click();
  await page.getByRole('dialog').locator('li', { hasText: name }).getByRole('button', { name: 'Choose' }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('dialog').getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 3000 });
  await settle(page);
}
const KLONDIKE = ['Standard 52', 'Waste', 'F1', 'F2', 'F3', 'F4', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'];

test('save a hand-built Klondike as a setup, apply it to a new table, undo, Play again (4.2)', async ({ browser }) => {
  test.setTimeout(120_000);
  const { ctx, page } = await newPlayer(browser, 'Alex', PHONE);
  await createTable(page, `Build ${Date.now() % 100000}`, { deck: 'builtin-standard-52' });
  for (const n of ['Discard', 'Table']) {
    await page.getByRole('button', { name: `${n} actions` }).click();
    await page.getByRole('button', { name: 'Remove zone' }).click();
  }
  await addZones(page, [['Waste', 'pile'], ['F1', 'pile'], ['F2', 'pile'], ['F3', 'pile'], ['F4', 'pile'], ...[1, 2, 3, 4, 5, 6, 7].map((k) => [`P${k}`, 'column'] as [string, string])]);
  await page.getByRole('button', { name: 'P1 actions' }).click();
  await page.getByLabel('Start a new row').click();
  await expect(page.getByLabel('Start a new row')).toBeChecked();
  await page.keyboard.press('Escape');
  // deal P1..P7 with k cards each, then turn each column's last card face up (double tap)
  for (let k = 1; k <= 7; k++) {
    await page.getByTestId('pile-Standard 52').click();
    await page.getByRole('button', { name: 'Draw…' }).click();
    await page.locator('#dcount').fill(String(k));
    await page.locator('#dto').selectOption({ label: `P${k}` });
    await page.getByRole('button', { name: `Draw ${k}` }).click();
    await expect(page.getByTestId(`row-P${k}`).locator('[data-h]')).toHaveCount(k);
  }
  await settle(page);
  for (let k = 1; k <= 7; k++) {
    const b = (await page.getByTestId(`row-P${k}`).locator('[data-h]').last().boundingBox())!;
    const p = { x: b.x + b.width / 2, y: b.y + b.height - 12 };
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(80);
    await page.touchscreen.tap(p.x, p.y);
    await expect.poll(() => faces(page, `P${k}`)).toEqual([...Array(k - 1).fill('down'), 'up']);
    await page.waitForTimeout(350);
  }

  // save the table as a setup and review the draft
  await openSettings(page);
  await page.getByRole('button', { name: 'Save table as setup…' }).click();
  await page.getByLabel('Setup name').fill('Klondike');
  await page.getByRole('button', { name: 'Record and review' }).click();
  await expect(page.getByRole('heading', { name: 'Klondike' })).toBeVisible();
  await expect(page.getByTestId('unsaved')).toBeVisible();
  await expect(page.getByLabel('Zone 13 name')).toHaveValue('P7');
  await expect(page.getByLabel('Zone 9 face down')).toHaveValue('2'); // P3
  await expect(page.getByLabel('Zone 9 face up')).toHaveValue('1');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.toast').filter({ hasText: 'Setup saved' })).toBeVisible();

  // a new table, then Apply setup…
  await page.goto('/');
  await createTable(page, `Solo ${Date.now() % 100000}`);
  await expect.poll(() => zoneOrder(page)).toEqual(['Discard', 'Table']);
  await applyFromSheet(page, 'Klondike');
  await expect.poll(() => zoneOrder(page)).toEqual(KLONDIKE);
  for (let k = 1; k <= 7; k++) expect(await faces(page, `P${k}`)).toEqual([...Array(k - 1).fill('down'), 'up']);
  await expect(page.getByTestId('pile-Standard 52').locator('.pile-count')).toHaveText('24');

  // undo restores the previous table (and Play again disappears with the setup)
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => zoneOrder(page)).toEqual(['Discard', 'Table']);
  await openSettings(page);
  await expect(page.getByRole('button', { name: /Play again/ })).toHaveCount(0);
  await page.keyboard.press('Escape');

  // apply again, then Play again: a fresh deal with the same counts
  await applyFromSheet(page, 'Klondike');
  await openSettings(page);
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Play again: Klondike' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await settle(page);
  await expect.poll(() => zoneOrder(page)).toEqual(KLONDIKE);
  for (let k = 1; k <= 7; k++) expect(await faces(page, `P${k}`)).toEqual([...Array(k - 1).fill('down'), 'up']);
  await page.getByRole('button', { name: 'Log', exact: true }).click();
  // the log keeps history: the first apply, its undo, the second apply and Play again
  await expect(page.getByLabel('Table log').locator('li').filter({ hasText: 'Alex applied Klondike' })).toHaveCount(3);
  await expect(page.getByLabel('Table log').locator('li').filter({ hasText: 'undid' })).toHaveCount(1);
  await ctx.close();
});

/** Creates and saves a setup through the API from inside the page (uses the tab's token). */
export async function makeSetup(page: Page, content: Record<string, unknown>) {
  return page.evaluate(async (content) => {
    const h = { authorization: `Bearer ${sessionStorage.getItem('vct.token')}`, 'content-type': 'application/json' };
    const s = await (await fetch('/api/setups', { method: 'POST', headers: h, body: JSON.stringify({ name: content.name }) })).json();
    const r = await fetch(`/api/setups/${s.id}/save`, { method: 'POST', headers: h, body: JSON.stringify({ content }) });
    if (!r.ok) throw new Error(await r.text());
    return s.id as string;
  }, content);
}
const perSeat = (name: string, players: { min: number; max: number }) => ({
  name,
  players,
  slots: [{ id: 's1', label: 'Deck', defaultDeckId: 'builtin-standard-52' }],
  homes: { s1: 'stock' },
  zones: [{ key: 'stock', name: 'Stock', layout: 'pile' }],
  hands: { count: 7 },
  counters: [{ label: '{name} score', value: 0, perSeat: true }],
});

test('a per-seat setup for 3 players: 7 cards each and a score counter per player; outside the range is refused (4.3)', async ({ browser }) => {
  const { ctx: c1, page: alex } = await newPlayer(browser, 'Alex', PHONE);
  await makeSetup(alex, perSeat('Rummy', { min: 2, max: 4 }));
  await makeSetup(alex, perSeat('Duel', { min: 2, max: 2 }));
  const name = `Three ${Date.now() % 100000}`;
  await createTable(alex, name);
  const others = await Promise.all(['Sam', 'Kim'].map((n) => newPlayer(browser, n, PHONE)));
  for (const o of others) await joinTable(o.page, name);
  await applyFromSheet(alex, 'Rummy');
  for (const p of [alex, ...others.map((o) => o.page)]) {
    await expect(p.getByTestId('row-hand').locator('[data-h]')).toHaveCount(7);
    for (const who of ['Alex', 'Sam', 'Kim']) await expect(p.getByTestId(`counter-${who} score`)).toBeVisible();
  }
  await expect(alex.getByTestId('pile-Stock').locator('.pile-count')).toHaveText(String(52 - 21));
  // a 2-player setup with 3 seated is refused, and nothing changes
  await applyFromSheet(alex, 'Duel').catch(() => {});
  await expect(alex.locator('.toast').filter({ hasText: 'Duel is for 2 players; 3 are seated' })).toBeVisible();
  await alex.keyboard.press('Escape');
  await expect(alex.getByTestId('row-hand').locator('[data-h]')).toHaveCount(7);
  await Promise.all([c1.close(), ...others.map((o) => o.ctx.close())]);
});

test('the New table dialog can start a table from a setup (4.3)', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex', PHONE);
  await makeSetup(page, {
    name: 'Solo',
    players: { min: 1, max: 1 },
    slots: [{ id: 's1', label: 'Deck', defaultDeckId: 'builtin-standard-52' }],
    homes: { s1: 'stock' },
    zones: [
      { key: 'stock', name: 'Stock', layout: 'pile' },
      { key: 'row', name: 'Row', layout: 'spread', up: 4 },
    ],
    counters: [{ label: 'Score', value: 10 }],
  });
  await page.reload();
  await page.getByRole('button', { name: '+ New table' }).click();
  await page.locator('#tname').fill(`From setup ${Date.now() % 100000}`);
  await page.locator('#tsetup').selectOption({ label: 'Solo' });
  await expect(page.locator('#tdeck')).toHaveCount(0);
  await page.getByRole('button', { name: 'Create and sit down' }).click();
  await expect.poll(() => zoneOrder(page)).toEqual(['Stock', 'Row']);
  await expect(page.getByTestId('row-Row').locator('[data-h].face')).toHaveCount(4);
  await expect(page.getByTestId('counter-Score')).toContainText('10');
  await ctx.close();
});
