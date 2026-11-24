import { test, expect } from '@playwright/test';
import { newPlayer, createTable, draw, handCards } from './helpers';
import { makeDeck, settle } from './table-helpers';

test('gather one deck into a zone; the other deck stays; one deck loaded shows only Gather all', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex');
  await makeDeck(page, 'Monsters', [{ name: 'Goblin', count: 3 }, { name: 'Orc', count: 1 }]);
  await createTable(page, 'Two decks', { deck: 'builtin-standard-52' });

  // one deck: only "Gather all here"
  await page.getByTestId('pile-Standard 52').click();
  await expect(page.getByRole('button', { name: 'Gather all here' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Gather Standard 52 here$/ })).toHaveCount(0);
  await page.keyboard.press('Escape');

  // load a second deck
  await page.getByRole('button', { name: 'Table settings' }).click();
  await page.getByRole('button', { name: 'Decks…' }).click();
  await page.getByLabel('Deck to load').selectOption({ label: 'Monsters (Alex)' });
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('pile-Monsters')).toBeVisible();

  await draw(page, 'Monsters', 2);
  await draw(page, 'Standard 52', 1);
  await expect(handCards(page)).toHaveCount(3);

  // gather only Monsters into the Standard 52 pile
  await page.getByTestId('pile-Standard 52').click();
  await page.getByRole('button', { name: 'Gather Monsters here' }).click();
  await settle(page);
  await expect(handCards(page)).toHaveCount(1); // the Standard card stays in hand
  await expect(page.getByRole('button', { name: 'Standard 52 actions' })).toContainText('55'); // 51 + 4 monsters
  await expect(page.getByRole('button', { name: 'Monsters actions' })).toContainText('0');
  await ctx.close();
});
