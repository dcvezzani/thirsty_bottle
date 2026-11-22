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
