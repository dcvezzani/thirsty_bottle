import { test, expect } from '@playwright/test';
import { newPlayer, createTable, joinTable, draw, closeAll, PHONE } from './helpers';

test('an unanswered request to see a hand expires after 5 seconds with a countdown, and can be asked again', async ({ browser }) => {
  const alex = await newPlayer(browser, 'Alex', PHONE);
  const sam = await newPlayer(browser, 'Sam', PHONE);
  const name = `Expiry ${Date.now() % 100000}`;
  await createTable(alex.page, name, { deck: 'builtin-standard-52' });
  await joinTable(sam.page, name);
  await draw(alex.page, 'Standard 52', 3);

  await sam.page.getByTestId('seat-Alex').click();
  await sam.page.getByRole('button', { name: 'View table' }).click();
  const col = sam.page.getByTestId('viewed-col');
  await col.getByRole('button', { name: 'Ask to see hand' }).click();

  const prompt = alex.page.getByRole('alertdialog', { name: 'Card request' });
  await expect(prompt).toContainText('Sam asks to see your hand');
  await expect(prompt.getByRole('timer')).toHaveText(/^[1-5]s$/);
  await expect(sam.page.getByText('Waiting for Alex to let you see their hand…')).toBeVisible();

  // nobody answers: the prompt and the asker's banner go, the asker is told, and nothing was shown
  await expect(prompt).toHaveCount(0, { timeout: 10_000 });
  await expect(sam.page.getByText('Waiting for Alex')).toHaveCount(0);
  await expect(sam.page.getByText("Alex didn't answer in time")).toBeVisible();
  await expect(col).toContainText('Alex · 3 · none shown');

  // ask again; this time Alex answers in time
  await col.getByRole('button', { name: 'Ask to see hand' }).click();
  await expect(prompt).toBeVisible();
  await prompt.getByRole('button', { name: 'Allow' }).click();
  await expect(col).toContainText('Alex · 3 · 3 shown');
  await closeAll(alex.ctx, sam.ctx);
});
