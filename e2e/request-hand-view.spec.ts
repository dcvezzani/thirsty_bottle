import { test, expect } from '@playwright/test';
import { newPlayer, createTable, joinTable, draw, closeAll, PHONE } from './helpers';
import { touchPath, line, settle } from './table-helpers';

test('ask to see a hand: allow shows every front, a later card stays hidden, the owner can stop; decline, cancel, leaving and spectators', async ({ browser }) => {
  const alex = await newPlayer(browser, 'Alex', PHONE);
  const sam = await newPlayer(browser, 'Sam', PHONE);
  const name = `Peek hand ${Date.now() % 100000}`;
  await createTable(alex.page, name, { deck: 'builtin-standard-52' });
  await joinTable(sam.page, name);
  await draw(alex.page, 'Standard 52', 4);

  // Sam views Alex's table: four backs, and the ask control
  await sam.page.getByTestId('seat-Alex').click();
  await sam.page.getByRole('button', { name: 'View table' }).click();
  const col = sam.page.getByTestId('viewed-col');
  await expect(col).toContainText('Alex · 4 · none shown');
  await expect(col.locator('.card-row .card.back')).toHaveCount(4);
  const ask = col.getByRole('button', { name: 'Ask to see hand' });
  await expect(ask).toBeVisible();

  // ask: Sam waits, Alex is prompted
  await ask.click();
  await expect(sam.page.getByRole('button', { name: 'Asked to see hand' })).toBeDisabled();
  await expect(sam.page.getByText('Waiting for Alex to let you see their hand…')).toBeVisible();
  const prompt = alex.page.getByRole('alertdialog', { name: 'Card request' });
  await expect(prompt).toContainText('Sam asks to see your hand');

  // allow: every front, scrubbable, and the log names no card
  await prompt.getByRole('button', { name: 'Allow' }).click();
  await expect(col).toContainText('Alex · 4 · 4 shown');
  await expect(col.locator('.card-row .card.face')).toHaveCount(4);
  await expect(sam.page.getByText('Waiting for Alex')).toHaveCount(0);
  const row = (await sam.page.getByTestId('row-viewed-hand').boundingBox())!;
  const y = row.y + row.height * 0.55;
  const cdp = await touchPath(sam.page, line({ x: row.x + 24, y }, { x: row.x + Math.min(row.width - 8, 110), y }, 8), { release: false });
  await expect(sam.page.locator('.card.focused')).toHaveCount(1); // the scrub preview
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await settle(sam.page);

  // a card drawn later stays hidden; the owner sees the eye marks and the stop control
  await draw(alex.page, 'Standard 52', 1);
  await expect(col).toContainText('Alex · 5 · 4 shown');
  await expect(col.locator('.card-row .card.back')).toHaveCount(1);
  await expect(col.getByRole('button', { name: 'Ask to see hand' })).toBeVisible(); // a hidden card remains
  await expect(alex.page.locator('[data-testid="row-hand"] .mark.shown')).toHaveCount(4);
  await alex.page.getByRole('button', { name: 'Stop showing my hand' }).click();
  await expect(col).toContainText('Alex · 5 · none shown');
  await expect(col.locator('.card-row .card.back')).toHaveCount(5);
  await expect(alex.page.getByRole('button', { name: 'Stop showing my hand' })).toHaveCount(0);

  // decline: backs stay, the control comes back
  await col.getByRole('button', { name: 'Ask to see hand' }).click();
  await alex.page.getByRole('alertdialog', { name: 'Card request' }).getByRole('button', { name: 'Decline' }).click();
  await expect(sam.page.getByText('Waiting for Alex')).toHaveCount(0);
  await expect(col.getByRole('button', { name: 'Ask to see hand' })).toBeVisible();
  await expect(col.locator('.card-row .card.back')).toHaveCount(5);

  // cancel: Alex's prompt goes away
  await col.getByRole('button', { name: 'Ask to see hand' }).click();
  await expect(alex.page.getByRole('alertdialog', { name: 'Card request' })).toBeVisible();
  await sam.page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(alex.page.getByRole('alertdialog', { name: 'Card request' })).toHaveCount(0);

  // returning to my own table drops a pending ask
  await col.getByRole('button', { name: 'Ask to see hand' }).click();
  await expect(alex.page.getByRole('alertdialog', { name: 'Card request' })).toBeVisible();
  await sam.page.getByRole('button', { name: 'Mine', exact: true }).click();
  await expect(alex.page.getByRole('alertdialog', { name: 'Card request' })).toHaveCount(0);
  await expect(sam.page.getByText('Waiting for Alex')).toHaveCount(0);

  // a spectator has no ask control
  const lee = await newPlayer(browser, 'Lee', PHONE);
  await joinTable(lee.page, name, { spectate: true });
  await expect(lee.page.getByTestId('viewed-col')).toBeVisible();
  await expect(lee.page.getByRole('button', { name: 'Ask to see hand' })).toHaveCount(0);
  await closeAll(alex.ctx, sam.ctx, lee.ctx);
});
