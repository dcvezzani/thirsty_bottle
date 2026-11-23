import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { newPlayer } from './helpers';

const png = (color: string) => sharp({ create: { width: 250, height: 350, channels: 3, background: color } }).png().toBuffer();

test('image library: bulk import, rename, pick a front, create cards from images, delete rules, privacy', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex');
  await page.getByRole('button', { name: 'Decks' }).click();
  await page.getByRole('button', { name: 'Images' }).click();
  await expect(page.getByRole('heading', { name: 'Images' })).toBeVisible();
  await expect(page.getByText('No images yet. Import some to get started.')).toBeVisible();

  // Bulk import: 4 good files and one that is not a readable image
  await page.getByLabel('Import images').setInputFiles([
    { name: 'red.png', mimeType: 'image/png', buffer: await png('#cc2222') },
    { name: 'green.png', mimeType: 'image/png', buffer: await png('#22aa44') },
    { name: 'blue.png', mimeType: 'image/png', buffer: await png('#2244cc') },
    { name: 'yellow.png', mimeType: 'image/png', buffer: await png('#ddcc22') },
    { name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not an image') },
  ]);
  await expect(page.getByText('Imported 4 images.')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('broken.png');
  const grid = page.getByRole('list', { name: 'Images' });
  await expect(grid.getByRole('listitem')).toHaveCount(4);

  // Rename
  await grid.getByRole('button', { name: 'red', exact: true }).click();
  await page.getByLabel('Name').fill('Red Knight');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(grid.getByRole('button', { name: 'Red Knight' })).toBeVisible();

  // Pick a card front from the library
  await page.getByRole('button', { name: 'Back to decks' }).click();
  await page.getByLabel('New deck name').fill('Painted');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name: 'Painted' })).toBeVisible();
  await page.getByRole('button', { name: '+ Add card' }).click();
  await page.locator('#cname').fill('Knight');
  await page.getByRole('button', { name: 'Choose from images…' }).first().click();
  await page.getByRole('dialog', { name: 'Choose from images' }).getByRole('button', { name: 'Use Red Knight' }).click();
  await expect(page.getByAltText('front', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('card-row')).toHaveCount(1);

  // Deck images: This deck / All, then create cards from images in tap order
  await page.getByRole('button', { name: 'Images', exact: true }).click();
  const section = page.getByRole('region', { name: 'Deck images' });
  await expect(section.getByRole('listitem')).toHaveCount(1);
  await section.getByRole('button', { name: 'All' }).click();
  await expect(section.getByRole('listitem')).toHaveCount(4);
  await section.getByRole('button', { name: 'Create cards…' }).click();
  await section.getByRole('button', { name: 'Select blue' }).click();
  await section.getByRole('button', { name: 'Select green' }).click();
  await section.getByRole('button', { name: 'Create 2 cards' }).click();
  const rows = page.getByTestId('card-row');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(1)).toContainText('blue');
  await expect(rows.nth(2)).toContainText('green');
  await expect(rows.nth(2).locator('img')).toHaveCount(1);

  // Delete rules: used is refused with its usage; unused is removed
  await section.getByRole('button', { name: 'Red Knight' }).click();
  await expect(page.getByText(/Used by 1 card in 1 deck/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete' })).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await section.getByRole('button', { name: 'yellow' }).click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(section.getByRole('listitem')).toHaveCount(3);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Deck saved')).toBeVisible();

  // Privacy: another player's library is empty
  const sam = await newPlayer(browser, 'Sam');
  await sam.page.goto('/images');
  await expect(sam.page.getByText('No images yet. Import some to get started.')).toBeVisible();
  await sam.ctx.close();
  await ctx.close();
});
