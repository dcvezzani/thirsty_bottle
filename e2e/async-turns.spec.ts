import { test, expect } from '@playwright/test';
import { newPlayer, createTable, joinTable, PHONE } from './helpers';

test('End turn passes to the next player, and to a player who has gone offline, who is still seated (3.2)', async ({ browser }) => {
  const alex = await newPlayer(browser, 'Alex', PHONE);
  const sam = await newPlayer(browser, 'Sam', PHONE);
  const name = `Async ${Date.now() % 100000}`;
  await createTable(alex.page, name, { deck: 'builtin-standard-52' });
  await joinTable(sam.page, name);
  await expect(alex.page.locator('.seat')).toHaveCount(1);

  await alex.page.getByTestId('mode-chip').click();
  const bar = (p: typeof alex.page) => p.getByTestId('turn-bar');
  await expect(bar(alex.page)).toContainText('Your turn');
  await expect(bar(sam.page)).toContainText("Alex's turn");

  // with both connected, tapping End turn moves the indicator for everyone
  await alex.page.getByRole('button', { name: 'End turn' }).click();
  await expect(bar(alex.page)).toContainText("Sam's turn");
  await expect(bar(sam.page)).toContainText('Your turn');
  await sam.page.getByRole('button', { name: 'End turn' }).click();
  await expect(bar(alex.page)).toContainText('Your turn');

  // Sam goes away (app closed); the turn still passes to Sam and waits there
  await sam.ctx.close();
  await expect(alex.page.locator('.seat.away')).toHaveCount(1, { timeout: 15_000 }); // Alex now sees Sam as disconnected
  await alex.page.getByRole('button', { name: 'End turn' }).click();
  await expect(bar(alex.page)).toContainText("Sam's turn");
  await expect(alex.page.locator('.seat')).toHaveCount(1); // Sam keeps the seat
  await alex.ctx.close();
});

test('the host sets the inactive table lifetime in days; other players see it read-only (3.1)', async ({ browser }) => {
  const alex = await newPlayer(browser, 'Alex', PHONE);
  const sam = await newPlayer(browser, 'Sam', PHONE);
  const name = `Idle ${Date.now() % 100000}`;
  await createTable(alex.page, name, { deck: 'builtin-standard-52' });
  await joinTable(sam.page, name);

  await alex.page.getByRole('button', { name: 'Table settings' }).click();
  const sel = alex.page.locator('#sidle');
  await expect(sel).toHaveValue('1');
  await sel.selectOption('7');
  await expect(sel).toHaveValue('7');
  await expect(sel.locator('option')).toHaveCount(30);

  await sam.page.getByRole('button', { name: 'Table settings' }).click();
  await expect(sam.page.locator('#sidle')).toHaveCount(0);
  await expect(sam.page.getByTestId('idle-days-readonly')).toContainText('7 days');
  await alex.ctx.close();
  await sam.ctx.close();
});
