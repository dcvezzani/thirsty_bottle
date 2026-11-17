import { test, expect, type Page } from '@playwright/test';
import sharp from 'sharp';
import { newPlayer } from './helpers';

async function png(color: string, w = 500, h = 700) {
  return sharp({ create: { width: w, height: h, channels: 3, background: color } }).png().toBuffer();
}

async function newDeck(page: Page, name: string) {
  await page.getByRole('button', { name: 'Decks' }).click();
  await page.getByLabel('New deck name').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

async function addCard(page: Page, name: string, count: number, meta: [string, string, string][] = [], art?: Buffer) {
  await page.getByRole('button', { name: '+ Add card' }).click();
  await page.locator('#cname').fill(name);
  await page.locator('#ccount').fill(String(count));
  if (art) {
    await page.getByLabel('Upload front').setInputFiles({ name: 'art.png', mimeType: 'image/png', buffer: art });
    await expect(page.getByAltText('front preview')).toBeVisible(); // preview before saving
    await page.getByRole('button', { name: 'Use this front' }).click();
    await expect(page.getByAltText('front', { exact: true })).toBeVisible();
  }
  for (const [k, type, v] of meta) {
    await page.getByRole('button', { name: '+ Property' }).click();
    const row = page.getByTestId('meta-row').last();
    await row.getByLabel('Property name').fill(k);
    await row.getByLabel('Property type').selectOption(type);
    if (type === 'boolean') await row.getByLabel('Property value').selectOption(v);
    else await row.getByLabel('Property value').fill(v);
  }
  await page.getByRole('button', { name: 'Done' }).click();
}

test('create a deck with 2 cards, custom metadata, abilities and art (8.3)', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex');
  await newDeck(page, 'Space Fleet');
  await addCard(page, 'Cruiser', 2, [['cost', 'number', '3'], ['faction', 'text', 'Terran'], ['tags', 'list', 'ship, capital']], await png('#3366cc'));
  await page.getByRole('button', { name: '+ Add card' }).click();
  await page.locator('#cname').fill('Fighter');
  await page.locator('#ccount').fill('0');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('alert')).toHaveText('Instance count must be at least 1');
  await page.locator('#ccount').fill('4');
  await page.getByRole('button', { name: '+ Ability' }).click();
  const ab = page.getByTestId('ability-row');
  await ab.getByLabel('Ability trigger').fill('On Play');
  await ab.getByLabel('Ability effect').fill('Draw Card');
  await ab.getByLabel('Ability value').fill('2');
  await ab.getByLabel('Ability target').fill('Self');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('unsaved')).toBeVisible();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Deck saved')).toBeVisible();
  await expect(page.getByTestId('card-row')).toHaveCount(2);
  await expect(page.getByText('2 definitions · 6 cards')).toBeVisible();
  const res = await page.evaluate(async () => {
    const id = location.pathname.split('/').pop();
    const r = await fetch(`/api/decks/${id}`, { headers: { authorization: `Bearer ${sessionStorage.getItem('vct.token')}` } });
    return r.json();
  });
  expect(res.content.cards[0]).toMatchObject({ name: 'Cruiser', count: 2, metadata: { cost: 3, faction: 'Terran', tags: ['ship', 'capital'] } });
  expect(res.content.cards[0].frontImageId).toMatch(/^[a-f0-9]{64}$/);
  expect(res.content.cards[1].abilities).toEqual([{ trigger: 'On Play', effect: 'Draw Card', value: 2, target: 'Self' }]);
  await ctx.close();
});

test('unsaved edits survive a reload; discard restores the saved version (8.2)', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex');
  await newDeck(page, 'Drafty');
  await addCard(page, 'Knight', 1);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Deck saved')).toBeVisible();
  await addCard(page, 'Rook', 2);
  await page.getByRole('button', { name: 'Duplicate Knight' }).click();
  await expect(page.getByTestId('card-row')).toHaveCount(3);
  await page.waitForTimeout(600); // draft autosave
  await page.reload();
  await expect(page.getByText('You have unsaved changes from earlier.')).toBeVisible();
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByTestId('card-row')).toHaveCount(3);
  await expect(page.getByTestId('unsaved')).toBeVisible();
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(page.getByTestId('card-row')).toHaveCount(1);
  await page.reload();
  await expect(page.getByText('You have unsaved changes from earlier.')).toHaveCount(0);
  await expect(page.getByTestId('card-row')).toHaveCount(1);
  // multi-select bulk count + reorder
  await addCard(page, 'Bishop', 1);
  await page.getByLabel('Select Knight').check();
  await page.getByLabel('Select Bishop').check();
  await page.getByLabel('Count for selected').fill('3');
  await page.getByRole('button', { name: 'Set count' }).click();
  await page.getByRole('button', { name: 'Move Bishop up' }).click();
  await expect(page.getByTestId('card-row').first()).toContainText(/Bishop\s*×3/);
  await ctx.close();
});

test('gallery: B finds A’s public deck, clones and edits it; A’s deck is unchanged; lifecycle (8.1)', async ({ browser }) => {
  const { ctx: c1, page: a } = await newPlayer(browser, 'Alex');
  a.on('dialog', (d) => d.accept());
  await newDeck(a, 'Tarot Major');
  await addCard(a, 'The Fool', 1);
  await addCard(a, 'The Magician', 1);
  await a.getByRole('button', { name: 'Save' }).click();
  await expect(a.getByText('Deck saved')).toBeVisible();
  await a.getByRole('button', { name: 'Deck settings' }).click();
  await a.locator('#dvis').selectOption('public');
  await expect(a.getByLabel('Share link')).toHaveValue(/\/d\//);
  const link = await a.getByLabel('Share link').inputValue();
  await a.keyboard.press('Escape');

  const { ctx: c2, page: b } = await newPlayer(browser, 'Sam');
  b.on('dialog', (d) => d.accept());
  await b.getByRole('button', { name: 'Decks' }).click();
  await b.getByRole('tab', { name: 'Gallery' }).click();
  await b.getByLabel('Search the gallery').fill('tarot');
  const row = b.getByTestId('deck-row').filter({ hasText: 'Tarot Major' });
  await expect(row).toContainText('by Alex');
  await row.getByRole('button', { name: 'Clone' }).click();
  await expect(b.getByText('Cloned from Tarot Major by Alex')).toBeVisible();
  await addCard(b, 'The Empress', 1);
  await b.getByRole('button', { name: 'Save' }).click();
  await expect(b.getByTestId('card-row')).toHaveCount(3);

  await a.reload();
  await expect(a.getByTestId('card-row')).toHaveCount(2);
  // share link view
  await b.goto(link);
  await expect(b.getByRole('heading', { name: 'Tarot Major' })).toBeVisible();

  // archive → hidden from my decks & gallery, link stops working; restore; delete only when archived
  await a.getByRole('button', { name: 'Deck settings' }).click();
  await expect(a.getByRole('button', { name: 'Delete permanently' })).toHaveCount(0);
  await a.getByRole('button', { name: 'Archive' }).click();
  await expect(a.getByText('This deck is archived.')).toBeVisible();
  await b.reload();
  await expect(b.getByRole('alert')).toHaveText('This deck is unavailable');
  await a.goto('/decks');
  await expect(a.getByLabel('My decks').getByText('Tarot Major')).toHaveCount(0);
  await a.getByRole('tab', { name: /Archived/ }).click();
  await a.getByRole('button', { name: 'Restore' }).click();
  await a.getByRole('tab', { name: 'My decks' }).click();
  await expect(a.getByLabel('My decks').getByText('Tarot Major')).toBeVisible();
  await a.getByLabel('My decks').getByText('Tarot Major').click();
  await a.getByRole('button', { name: 'Deck settings' }).click();
  await a.getByRole('button', { name: 'Archive' }).click();
  await a.goto('/decks');
  await a.getByRole('tab', { name: /Archived/ }).click();
  await a.getByRole('button', { name: 'Delete Tarot Major permanently' }).click();
  await expect(a.getByText('No archived decks.')).toBeVisible();
  // Sam's clone survives
  await b.goto('/decks');
  await expect(b.getByLabel('My decks').getByTestId('deck-row').filter({ hasText: 'Cloned from Tarot Major by Alex' })).toBeVisible();
  await Promise.all([c1.close(), c2.close()]);
});

test('export and re-import a deck; a text-only card renders its name (8.4)', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex', { acceptDownloads: true });
  await newDeck(page, 'Portable');
  await addCard(page, 'Text Only Card', 2, [['power', 'number', '7']]);
  await addCard(page, 'Painted', 1, [], await png('#aa3355'));
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Deck saved')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Text Only Card' }).first()).toContainText('Text Only Card');
  await page.getByRole('button', { name: 'Deck settings' }).click();
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export .zip' }).click();
  const file = await (await dl).path();
  await page.keyboard.press('Escape');
  await page.goto('/decks');
  await page.getByLabel('Import deck').setInputFiles(file!);
  await expect(page.getByText('Imported "Portable"')).toBeVisible();
  await expect(page.getByTestId('card-row')).toHaveCount(2);
  await expect(page.getByTestId('card-row').first()).toContainText(/Text Only Card\s*×2/);
  await page.goto('/decks');
  await expect(page.getByLabel('My decks').getByTestId('deck-row').filter({ hasText: 'Portable' })).toHaveCount(2);
  await ctx.close();
});
