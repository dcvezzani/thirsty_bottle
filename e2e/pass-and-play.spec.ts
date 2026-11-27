import { test, expect, type Page } from '@playwright/test';
import { newPlayer, createTable, joinTable, PHONE } from './helpers';
import { lowContrast } from './contrast';

const bar = (p: Page) => p.getByTestId('turn-bar');
const cover = (p: Page) => p.getByTestId('handoff-cover');

async function addGuest(page: Page, name: string) {
  await page.getByLabel('Name of a player on this phone').fill(name);
  await page.getByRole('button', { name: 'Add player on this phone' }).click();
  await expect(page.getByTestId(`phone-guest-${name}`)).toBeVisible();
}
const closeSheet = (p: Page) => p.keyboard.press('Escape');

test('two guests share the host phone with a remote player: covers, handoffs, no hand behind a cover, removal frees a seat (3.1)', async ({ browser }) => {
  test.setTimeout(120_000);
  const alex = await newPlayer(browser, 'Alex', PHONE);
  const remy = await newPlayer(browser, 'Remy', PHONE);
  const name = `Phone ${Date.now() % 100000}`;
  await createTable(alex.page, name, { deck: 'builtin-standard-52' });
  await joinTable(remy.page, name);
  await alex.page.getByRole('button', { name: 'Table settings' }).click();
  await addGuest(alex.page, 'Sam');
  await addGuest(alex.page, 'Kim');
  await closeSheet(alex.page);
  await expect(alex.page.getByLabel('Name of a player on this phone')).toHaveCount(0);

  // everyone sees the guests as normal seats; remote players see them as on a shared phone
  await expect(remy.page.getByRole('button', { name: /^Sam, on a shared phone/ })).toBeVisible();
  await expect(remy.page.getByRole('button', { name: /^Kim, on a shared phone/ })).toBeVisible();

  // the table's seats are Alex, Remy, Sam, Kim: turn-based, Alex first
  await alex.page.getByTestId('mode-chip').click();
  await expect(bar(alex.page)).toContainText('Your turn');
  await alex.page.getByRole('button', { name: 'End turn' }).click();

  // Remy's turn is on another device: the shared phone is covered and shows no hand
  await expect(cover(alex.page)).toContainText('Waiting for');
  await expect(cover(alex.page)).toContainText('Remy');
  await expect(alex.page.getByTestId('row-hand')).toHaveCount(0);

  await remy.page.getByRole('button', { name: 'End turn' }).click();
  // Sam is next on the phone: pass the phone, nothing of the table is visible until Sam taps
  await expect(cover(alex.page)).toContainText('Pass the phone to');
  await expect(cover(alex.page)).toContainText('Sam');
  await expect(alex.page.getByTestId('row-hand')).toHaveCount(0);
  await expect(alex.page.getByTestId('turn-bar')).toHaveCount(0);
  await alex.page.getByRole('button', { name: /I'm Sam/ }).click();
  await expect(bar(alex.page)).toContainText('Your turn');
  await expect(alex.page.getByTestId('row-hand')).toBeVisible();

  await alex.page.getByRole('button', { name: 'End turn' }).click();
  await expect(cover(alex.page)).toContainText('Kim');
  await alex.page.getByRole('button', { name: /I'm Kim/ }).click();
  await expect(bar(alex.page)).toContainText('Your turn');
  await alex.page.getByRole('button', { name: 'End turn' }).click();
  await expect(cover(alex.page)).toContainText('Alex');
  await alex.page.getByRole('button', { name: /I'm Alex/ }).click();
  await expect(bar(alex.page)).toContainText('Your turn');

  // real-time: no automatic handoff; the switcher changes who is playing, behind a cover
  await alex.page.getByTestId('mode-chip').click();
  await expect(alex.page.getByTestId('mode-chip')).toHaveText('Real-time');
  await alex.page.getByTestId('who-playing').click();
  await expect(cover(alex.page)).toContainText("Who's playing?");
  await alex.page.getByRole('button', { name: 'Sam', exact: true }).click();
  await expect(cover(alex.page)).toContainText('Sam');
  await alex.page.getByRole('button', { name: /I'm Sam/ }).click();
  await expect(alex.page.getByTestId('row-hand')).toBeVisible();

  // back as the host: removing a guest frees its seat
  await alex.page.getByTestId('who-playing').click();
  await alex.page.getByRole('button', { name: 'Alex', exact: true }).click();
  await alex.page.getByRole('button', { name: /I'm Alex/ }).click();
  await alex.page.getByRole('button', { name: 'Table settings' }).click();
  await alex.page.getByRole('button', { name: 'Remove Kim' }).click();
  await expect(alex.page.getByTestId('phone-guest-Kim')).toHaveCount(0);
  await expect(remy.page.getByRole('button', { name: /^Kim/ })).toHaveCount(0);
  await alex.ctx.close();
  await remy.ctx.close();
});

for (const scheme of ['light', 'dark'] as const) {
  test(`the covers and the phone players controls are readable in ${scheme} mode (3.1)`, async ({ browser }) => {
    const ctx = await browser.newContext({ ...PHONE, colorScheme: scheme });
    const page = await ctx.newPage();
    const { onboard } = await import('./helpers');
    await onboard(page, 'Alex');
    await createTable(page, `Covers ${scheme} ${Date.now() % 100000}`, { deck: 'builtin-standard-52' });
    await page.getByRole('button', { name: 'Table settings' }).click();
    await addGuest(page, 'Sam');
    const bad = async (state: string) => {
      const issues = await lowContrast(page);
      expect(issues, `${state}: ${issues.map((i) => `${i.kind} ${i.element} "${i.text}" ${i.ratio} < ${i.required}`).join('\n')}`).toEqual([]);
    };
    await bad('phone players controls');
    await page.keyboard.press('Escape');
    await page.getByTestId('who-playing').click();
    await expect(cover(page)).toContainText("Who's playing?");
    await bad('who is playing');
    await page.getByRole('button', { name: 'Sam', exact: true }).click();
    await expect(cover(page)).toContainText('Pass the phone to');
    await bad('pass the phone');
    await ctx.close();
  });
}

test('a guest whose identity is lost from the phone is flagged to the host and can be removed (3.1)', async ({ browser }) => {
  const alex = await newPlayer(browser, 'Alex', PHONE);
  await createTable(alex.page, `Lost ${Date.now() % 100000}`, { deck: 'builtin-standard-52' });
  await alex.page.getByRole('button', { name: 'Table settings' }).click();
  await addGuest(alex.page, 'Sam');
  await expect(alex.page.getByTestId('phone-guest-Sam')).not.toContainText('not on this phone');
  // the phone's storage is cleared of the guest (the host's own sign-in is kept)
  await alex.page.evaluate(() => localStorage.removeItem('vct.phone'));
  await alex.page.reload();
  await expect(alex.page.getByRole('button', { name: 'Table settings' })).toBeVisible();
  await alex.page.getByRole('button', { name: 'Table settings' }).click();
  await expect(alex.page.getByTestId('phone-guest-Sam')).toContainText('not on this phone');
  await alex.page.getByRole('button', { name: 'Remove Sam' }).click();
  await expect(alex.page.getByTestId('phone-guest-Sam')).toHaveCount(0);
  await alex.ctx.close();
});
