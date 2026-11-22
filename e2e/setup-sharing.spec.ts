import { test, expect, type Page } from '@playwright/test';
import { newPlayer, createTable, PHONE } from './helpers';
import { settle } from './table-helpers';

// setup-sharing e2e
const call = (page: Page, method: string, url: string, body?: unknown) =>
  page.evaluate(
    async ({ method, url, body }) => {
      const h = { authorization: `Bearer ${sessionStorage.getItem('vct.token')}`, 'content-type': 'application/json' };
      const r = await fetch(url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
      return r.json();
    },
    { method, url, body },
  );
async function privateDeck(page: Page, name: string) {
  const d = await call(page, 'POST', '/api/decks', { name });
  await call(page, 'POST', `/api/decks/${d.id}/draft/ops`, { ops: [{ op: 'add', card: { name: 'Blank', count: 60, metadata: {} } }] });
  await call(page, 'POST', `/api/decks/${d.id}/save`, {});
  return d.id as string;
}
async function setupWithDeck(page: Page, name: string, deckId: string) {
  const s = await call(page, 'POST', '/api/setups', { name });
  await call(page, 'POST', `/api/setups/${s.id}/save`, {
    content: {
      name,
      players: { min: 1, max: 4 },
      slots: [{ id: 's1', label: 'Deck', defaultDeckId: deckId }],
      homes: { s1: 'stock' },
      zones: [
        { key: 'stock', name: 'Stock', layout: 'pile' },
        { key: 'melds', name: 'Melds', layout: 'spread', up: 2 },
      ],
      hands: { count: 5 },
      counters: [],
    },
  });
  return s.id as string;
}
const zoneOrder = (page: Page) => page.locator('.board section.zone').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));

test('publish with a deck warning; another player finds, opens read-only, clones, follows the link and reports (2.1)', async ({ browser }) => {
  const { ctx: c1, page: alex } = await newPlayer(browser, 'Alex', PHONE);
  const deckId = await privateDeck(alex, 'Alex deck');
  const id = await setupWithDeck(alex, 'Rummy club', deckId);
  await alex.goto(`/setups/${id}`);
  await alex.locator('#svisibility').selectOption('public');
  await expect(alex.getByRole('note')).toContainText("Other players can't use Alex deck");
  const shareUrl = await alex.getByLabel('Setup share link').inputValue();
  expect(shareUrl).toMatch(/\/s\/\w+/);

  const { ctx: c2, page: sam } = await newPlayer(browser, 'Sam', PHONE);
  await sam.getByRole('button', { name: 'Setups' }).click();
  await sam.getByRole('tab', { name: 'Gallery' }).click();
  await sam.getByLabel('Search setups').fill('rum');
  await expect(sam.getByLabel('Setup gallery').getByTestId('setup-row')).toHaveCount(1);
  await sam.getByLabel('Setup gallery').getByTestId('setup-row').locator('.grow').click();
  await expect(sam.getByTestId('setup-owner')).toContainText('By Alex');
  await expect(sam.getByLabel('Zone 2 name')).toBeDisabled();
  await expect(sam.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
  await sam.getByRole('button', { name: 'Clone' }).click();
  await expect(sam.getByRole('heading', { name: 'Rummy club' })).toBeVisible();
  await expect(sam.getByText('Cloned from Rummy club by Alex')).toBeVisible();
  await expect(sam.getByLabel('Zone 2 name')).toBeEnabled();
  // the share link opens the read-only view
  await sam.goto(new URL(shareUrl).pathname);
  await expect(sam.getByTestId('setup-owner')).toContainText('By Alex');
  // report: hidden from the gallery
  await sam.goto(`/setups/${id}`);
  sam.once('dialog', (d) => d.accept('looks like spam'));
  await sam.getByRole('button', { name: 'Report' }).click();
  await expect(sam.locator('.toast').filter({ hasText: 'reported' })).toBeVisible();
  await sam.goto('/setups');
  await sam.getByRole('tab', { name: 'Gallery' }).click();
  await sam.getByLabel('Search setups').fill('rum');
  await expect(sam.getByLabel('Setup gallery').getByText('No public setups found.')).toBeVisible();
  await Promise.all([c1.close(), c2.close()]);
});

test("built-in Klondike for a solo host; Sam applies Alex's public setup choosing his own deck; Play again (2.2)", async ({ browser }) => {
  const { ctx: c1, page: alex } = await newPlayer(browser, 'Alex', PHONE);
  const deckId = await privateDeck(alex, 'Alex deck');
  const id = await setupWithDeck(alex, 'Melds', deckId);
  await call(alex, 'PUT', `/api/setups/${id}/visibility`, { visibility: 'public' });

  // solo host: built-in Klondike
  await createTable(alex, `Solo ${Date.now() % 100000}`);
  await alex.getByRole('button', { name: 'Table settings' }).click();
  await alex.getByRole('button', { name: 'Apply setup…' }).click();
  await alex.getByLabel('Built-in setups').locator('li', { hasText: 'Klondike' }).getByRole('button', { name: 'Choose' }).click();
  alex.once('dialog', (d) => d.accept());
  await alex.getByRole('dialog').getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(alex.getByRole('dialog')).toHaveCount(0);
  await settle(alex);
  await expect.poll(() => zoneOrder(alex)).toEqual(['Stock', 'Waste', 'F1', 'F2', 'F3', 'F4', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7']);
  for (let k = 1; k <= 7; k++) await expect(alex.getByTestId(`row-P${k}`).locator('[data-h]')).toHaveCount(k);

  // Sam hosts and applies Alex's public setup from the gallery search
  const { ctx: c2, page: sam } = await newPlayer(browser, 'Sam', PHONE);
  await createTable(sam, `Sam table ${Date.now() % 100000}`);
  await sam.getByRole('button', { name: 'Table settings' }).click();
  await sam.getByRole('button', { name: 'Apply setup…' }).click();
  await sam.getByLabel('Search public setups').fill('melds');
  await sam.getByLabel('Public setups').locator('li', { hasText: 'Melds' }).getByRole('button', { name: 'Choose' }).click();
  await expect(sam.getByText("The setup's own deck isn't available to you; choose one.")).toBeVisible();
  await expect(sam.getByRole('dialog').getByRole('button', { name: 'Apply', exact: true })).toBeDisabled();
  await sam.locator('#slot-s1').selectOption({ label: 'Standard 52' });
  sam.once('dialog', (d) => d.accept());
  await sam.getByRole('dialog').getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(sam.getByRole('dialog')).toHaveCount(0);
  await settle(sam);
  await expect.poll(() => zoneOrder(sam)).toEqual(['Stock', 'Melds']);
  await expect(sam.getByTestId('row-hand').locator('[data-h]')).toHaveCount(5);
  // Play again on Alex's setup reuses the deck Sam chose
  await sam.getByRole('button', { name: 'Table settings' }).click();
  sam.once('dialog', (d) => d.accept());
  await sam.getByRole('button', { name: 'Play again: Melds' }).click();
  await expect(sam.getByRole('dialog')).toHaveCount(0);
  await settle(sam);
  await sam.getByRole('button', { name: 'Log', exact: true }).click();
  await expect(sam.getByLabel('Table log').locator('li').filter({ hasText: 'Sam applied Melds' })).toHaveCount(2);
  await expect(sam.locator('.toast').filter({ hasText: 'choose another' })).toHaveCount(0);
  await Promise.all([c1.close(), c2.close()]);
});

test('Use at my table also works on your own setup; disabled with a hint while unsaved (2.3)', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex', PHONE);
  const id = await setupWithDeck(page, 'Own game', 'builtin-standard-52');
  await page.goto(`/setups/${id}`);
  await expect(page.getByRole('button', { name: 'Use at my table' })).toHaveCount(0); // not hosting yet
  await page.goto('/');
  await createTable(page, `Own ${Date.now() % 100000}`);
  await page.goto(`/setups/${id}`);
  const use = page.getByRole('button', { name: 'Use at my table' });
  await expect(use).toBeEnabled();
  // an unsaved edit disables it, with the hint
  await page.getByLabel('Zone 2 name').fill('Melds edited');
  await expect(use).toBeDisabled();
  await expect(page.getByText('Save first to use it at your table')).toBeVisible();
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(use).toBeEnabled();
  await use.click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Own game' })).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('dialog').getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await settle(page);
  await expect.poll(() => zoneOrder(page)).toEqual(['Stock', 'Melds']);
  await ctx.close();
});
