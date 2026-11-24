import { test, expect } from '@playwright/test';
import { newPlayer, createTable, joinTable, handCards, closeAll } from './helpers';
import { lastLog, settle } from './table-helpers';

test('per-player zones: one definition, own copy on each board, face rules, take and pass, counts, late joiner', async ({ browser }) => {
  const alex = await newPlayer(browser, 'Alex');
  const sam = await newPlayer(browser, 'Sam');
  await createTable(alex.page, 'Personal areas', { deck: 'builtin-standard-52' });
  await joinTable(sam.page, 'Personal areas');

  // the host adds a per-player Tableau
  await alex.page.getByRole('button', { name: 'Table settings' }).click();
  await alex.page.getByLabel('New zone name').fill('Tableau');
  await alex.page.getByLabel('One per player (each player gets their own copy)').check();
  await alex.page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click();
  await alex.page.keyboard.press('Escape');
  for (const p of [alex.page, sam.page]) {
    await expect(p.getByRole('button', { name: 'Tableau actions' })).toHaveCount(1); // only my own copy on my board
    await expect(p.locator('.zone-name', { hasText: /^Tableau$/ })).toBeVisible(); // my own copy: just the zone name
  }

  // Alex draws a card into their Tableau and turns it face up, then a face-down one
  const drawToTableau = async () => {
    await alex.page.getByTestId('pile-Standard 52').click();
    await alex.page.getByRole('button', { name: 'Draw…' }).click();
    await alex.page.locator('#dto').selectOption({ label: 'Tableau' });
    await alex.page.getByRole('button', { name: 'Draw 1' }).click();
  };
  await drawToTableau();
  await alex.page.getByRole('button', { name: 'Tableau actions' }).click();
  await alex.page.getByRole('button', { name: 'All face up' }).click();
  await drawToTableau();
  await settle(alex.page);
  const alexRow = alex.page.getByTestId('row-Tableau').locator('[data-h]');
  await expect(alexRow).toHaveCount(2);
  expect(await lastLog(alex.page)).toMatch(/Alex drew 1 card from the top of Standard 52 to Alex's Tableau/);

  // Sam: the seat chip shows only name and hand count; the seat sheet shows the count, the face-up card and a back
  await expect(sam.page.getByTestId('seat-Alex')).not.toContainText('Tableau');
  await expect(sam.page.getByTestId('row-Tableau').locator('[data-h]')).toHaveCount(0); // Sam's own copy is empty
  await sam.page.getByTestId('seat-Alex').click();
  const sheet = sam.page.getByRole('region', { name: "Alex's Tableau" });
  await expect(sheet.getByRole('heading')).toHaveText('Tableau · 2');
  await expect(sheet.getByRole('button', { name: /^Ask to take (?!face-down)/ })).toHaveCount(1);
  await expect(sheet.getByRole('button', { name: 'Ask to take face-down card 2' })).toBeVisible();

  // taking asks first
  await sheet.getByRole('button', { name: 'Ask to take face-down card 2' }).click();
  await expect(alex.page.getByText('Sam wants 1 card from your Tableau')).toBeVisible();
  await alex.page.getByRole('button', { name: 'Allow' }).click();
  await expect(handCards(sam.page)).toHaveCount(1);
  await expect(alexRow).toHaveCount(1);

  // Sam passes the card back into Alex's Tableau
  await handCards(sam.page).first().click({ position: { x: 8, y: 30 } });
  await sam.page.getByTestId('seat-Alex').click();
  await sam.page.getByRole('button', { name: 'Pass 1 selected to Tableau' }).click();
  await expect(alexRow).toHaveCount(2);

  // a late joiner gets an empty copy
  const kim = await newPlayer(browser, 'Kim');
  await joinTable(kim.page, 'Personal areas');
  await expect(kim.page.locator('.zone-name', { hasText: /^Tableau$/ })).toBeVisible();
  await expect(kim.page.getByTestId('row-Tableau').locator('[data-h]')).toHaveCount(0);
  await kim.page.getByTestId('seat-Alex').click();
  await expect(kim.page.getByRole('region', { name: "Alex's Tableau" }).getByRole('heading')).toHaveText('Tableau · 2');
  await closeAll(alex.ctx, sam.ctx, kim.ctx);
});
