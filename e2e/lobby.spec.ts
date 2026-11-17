import { test, expect, type Page } from '@playwright/test';
import { newPlayer, createTable, joinTable, PHONE } from './helpers';

const PHONE_360 = { ...PHONE, viewport: { width: 360, height: 740 } };

async function assertMobileFriendly(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('button, [role=tab], input, select')]
      .filter((el) => el.offsetParent !== null && !el.closest('.chat-msg') && !el.closest('.pill'))
      .map((el) => {
        // a checkbox's touch target is its whole label row
        const t = (el as HTMLInputElement).type === 'checkbox' ? (el.closest('label') ?? el) : el;
        const r = t.getBoundingClientRect();
        return { el: el.getAttribute('aria-label') || t.textContent?.trim(), w: r.width, h: r.height };
      })
      .filter((r) => r.h < 44 || r.w < 44),
  );
  expect(small, 'touch targets ≥ 44px').toEqual([]);
}

test('mobile lobby at 360×740: tabs, create table (only name required), open seating, join flows', async ({ browser }) => {
  const { ctx: c1, page: alex } = await newPlayer(browser, 'Alex', PHONE_360);
  await assertMobileFriendly(alex);
  await alex.getByRole('tab', { name: /Players/ }).click();
  await expect(alex.getByLabel('Online players')).toContainText('Alex');
  await assertMobileFriendly(alex);
  await alex.getByRole('tab', { name: 'Chat' }).click();
  await expect(alex.getByLabel('Message the lobby')).toBeVisible();
  await assertMobileFriendly(alex);
  await alex.getByRole('tab', { name: 'Tables' }).click();
  await alex.getByRole('button', { name: '+ New table' }).click();
  await assertMobileFriendly(alex);
  await alex.keyboard.press('Escape');

  await createTable(alex, 'Quick Game');
  const { ctx: c2, page: sam } = await newPlayer(browser, 'Sam', PHONE_360);
  const row = sam.getByTestId('table-row').filter({ hasText: 'Quick Game' });
  await expect(row).toContainText('1 player, open seating');
  await expect(row).toContainText('Real-time');
  await assertMobileFriendly(sam);
  await joinTable(sam, 'Quick Game');
  await expect(sam.getByTestId('seat-Alex')).toBeVisible();

  // presence: Alex appears as at the table in Sam's... check from a lobby viewer
  const { ctx: c3, page: kim } = await newPlayer(browser, 'Kim', PHONE_360);
  await kim.getByRole('tab', { name: /Players/ }).click();
  await expect(kim.getByLabel('Online players').getByText('at Quick Game')).toHaveCount(2);
  await kim.getByRole('tab', { name: 'Tables' }).click();
  await expect(kim.getByTestId('table-row').filter({ hasText: 'Quick Game' })).toContainText('2 players, open seating');
  await Promise.all([c1.close(), c2.close(), c3.close()]);
});

test('password tables, private invite links, full tables offer spectating', async ({ browser }) => {
  const { ctx: c1, page: alex } = await newPlayer(browser, 'Alex', PHONE_360);
  await createTable(alex, 'Secret', { password: 'hunter2', seats: '1' });
  const url = alex.url();
  const { ctx: c2, page: sam } = await newPlayer(browser, 'Sam', PHONE_360);
  const row = sam.getByTestId('table-row').filter({ hasText: 'Secret' });
  await expect(row).toContainText('🔒 Password');
  await row.getByRole('button', { name: 'Join' }).click();
  await sam.locator('#jpw').fill('wrong');
  await sam.getByRole('button', { name: 'Take a seat' }).click();
  await expect(sam.getByRole('alert')).toHaveText('Incorrect password');
  await sam.locator('#jpw').fill('hunter2');
  await sam.getByRole('button', { name: 'Take a seat' }).click();
  await expect(sam.getByRole('alert')).toContainText('All seats are taken');
  await sam.getByRole('button', { name: 'Watch' }).click();
  await expect(sam.getByText('You are watching. Hands stay hidden.')).toBeVisible();
  // invite link opens the join sheet directly
  const { ctx: c3, page: kim } = await newPlayer(browser, 'Kim', PHONE_360);
  await kim.goto(url);
  await expect(kim.getByRole('dialog', { name: 'Join Secret' })).toBeVisible();
  await Promise.all([c1.close(), c2.close(), c3.close()]);
});
