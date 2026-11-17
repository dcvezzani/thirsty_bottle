import { test, expect } from '@playwright/test';
import { newPlayer, createTable, joinTable, PHONE } from './helpers';

test('two players exchange lobby messages; script stays inert; unread badges; lobby chat from a table', async ({ browser }) => {
  const { ctx: c1, page: alex } = await newPlayer(browser, 'Alex', PHONE);
  const { ctx: c2, page: sam } = await newPlayer(browser, 'Sam', PHONE);
  await alex.getByRole('tab', { name: 'Chat' }).click();
  await alex.getByLabel('Message the lobby').fill('anyone up for spades?');
  await alex.getByRole('button', { name: 'Send' }).click();
  // Sam is on the Tables tab → unread badge
  await expect(sam.getByRole('tab', { name: /Chat/ }).getByLabel('1 unread')).toBeVisible();
  await sam.getByRole('tab', { name: /Chat/ }).click();
  await expect(sam.getByTestId('chat-msg').filter({ hasText: 'anyone up for spades?' })).toBeVisible();
  let dialogs = 0;
  sam.on('dialog', (d) => (dialogs++, d.dismiss()));
  alex.on('dialog', (d) => (dialogs++, d.dismiss()));
  await sam.getByLabel('Message the lobby').fill('<script>alert(1)</script><img src=x onerror=alert(2)>');
  await sam.getByRole('button', { name: 'Send' }).click();
  const msg = alex.getByTestId('chat-msg').filter({ hasText: '<script>alert(1)</script>' });
  await expect(msg).toBeVisible();
  expect(await alex.locator('.chat-log script, .chat-log img').count()).toBe(0);
  await alex.waitForTimeout(300);
  expect(dialogs).toBe(0);

  // seated at a table, Alex can still read and post to the lobby without leaving
  await alex.getByRole('tab', { name: 'Tables' }).click();
  await createTable(alex, 'Hearts night');
  await alex.getByRole('button', { name: 'Lobby', exact: true }).click();
  await expect(alex.getByRole('region', { name: 'lobby panel' }).getByText('anyone up for spades?')).toBeVisible();
  await alex.getByLabel('Message the lobby').fill('need one more for hearts');
  await alex.getByRole('button', { name: 'Send' }).click();
  await expect(sam.getByTestId('chat-msg').filter({ hasText: 'need one more for hearts' })).toBeVisible();
  await expect(alex.getByRole('button', { name: 'Table settings' })).toBeVisible();

  // room chat is private to the table, and shows joins as system messages
  await joinTable(sam, 'Hearts night');
  await alex.getByRole('button', { name: 'Room', exact: true }).click();
  await expect(alex.getByTestId('chat-system').filter({ hasText: 'Sam joined seat 2' })).toBeVisible();
  await alex.getByLabel('Message the room').fill('welcome!');
  await alex.getByRole('button', { name: 'Send' }).click();
  await expect(sam.getByRole('button', { name: /Room/ }).locator('.badge')).toHaveText('1');
  await sam.getByRole('button', { name: /Room/ }).click();
  await expect(sam.getByTestId('chat-msg').filter({ hasText: 'welcome!' })).toBeVisible();

  // mute
  await sam.getByLabel('Mute Alex').first().click();
  await alex.getByLabel('Message the room').fill('can you hear me?');
  await alex.getByRole('button', { name: 'Send' }).click();
  await alex.waitForTimeout(400);
  await expect(sam.getByTestId('chat-msg').filter({ hasText: 'can you hear me?' })).toHaveCount(0);
  await Promise.all([c1.close(), c2.close()]);
});
