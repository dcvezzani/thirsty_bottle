import { test, expect } from '@playwright/test';
import { newPlayer, createTable, joinTable, closeAll, PHONE } from './helpers';

test('a seat chip stays one line with seven per-player zones and a disconnected player; the sheet has the details', async ({ browser }) => {
  const george = await newPlayer(browser, 'George', PHONE);
  const sam = await newPlayer(browser, 'Sam', PHONE);
  await createTable(george.page, 'HP', { deck: 'builtin-standard-52' });
  await joinTable(sam.page, 'HP');
  await george.page.getByRole('button', { name: 'Table settings' }).click();
  for (let i = 1; i <= 7; i++) {
    await george.page.getByLabel('New zone name').fill(`P1.${i}`);
    await george.page.getByLabel('New zone layout').selectOption('pile');
    await george.page.getByLabel('One per player (each player gets their own copy)').check();
    await george.page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click();
  }
  await george.page.keyboard.press('Escape');
  // own copies show just the zone name
  await expect(george.page.locator('.zone-name', { hasText: /^P1\.1$/ })).toBeVisible();

  const chip = sam.page.getByTestId('seat-George');
  await expect(chip).toHaveText(/^👑 George\s*0$/);
  const oneLine = async () => expect((await chip.boundingBox())!.height).toBeLessThanOrEqual(52);
  await oneLine();

  // George disconnects: the chip stays one line; the status is in its name and in the sheet
  await george.ctx.close();
  await expect(chip).toHaveAttribute('aria-label', /George, host, disconnected: 0 cards in hand/, { timeout: 15_000 });
  await oneLine();
  await chip.click();
  await expect(sam.page.getByTestId('seat-status')).toHaveText('host · disconnected');
  for (let i = 1; i <= 7; i++) await expect(sam.page.getByRole('region', { name: `George's P1.${i}` }).getByRole('heading')).toHaveText(`P1.${i} · 0`);
  await closeAll(sam.ctx);
});
