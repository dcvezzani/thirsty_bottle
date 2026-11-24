import { test, expect, type Page, type Locator } from '@playwright/test';
import { newPlayer, createTable, joinTable, handCards, closeAll, PHONE } from './helpers';
import { touchPath, line, settle, stripCenters } from './table-helpers';

const center = async (l: Locator) => {
  await l.scrollIntoViewIfNeeded();
  const b = (await l.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
/** Drag with a finger: press, lift off vertically to start the drag, then travel to the target. */
async function drag(page: Page, from: Locator, to: Locator) {
  const a = await center(from);
  const b = await center(to);
  await touchPath(page, [a, { x: a.x, y: a.y - 15 }, ...line({ x: a.x, y: a.y - 15 }, b, 12)]);
  await settle(page);
}
async function drawInto(page: Page, label: string, faceUp = false) {
  await page.getByTestId('pile-Standard 52').click();
  await page.getByRole('button', { name: 'Draw…' }).click();
  await page.locator('#dto').selectOption({ label });
  await page.getByRole('button', { name: 'Draw 1' }).click();
  if (faceUp) {
    await page.getByRole('button', { name: 'Tableau actions' }).click();
    await page.getByRole('button', { name: 'All face up' }).click();
  }
}

test('player views: view, rotate, presence for everyone, permissions while viewing, spectators rotate', async ({ browser }) => {
  const alex = await newPlayer(browser, 'Alex', PHONE);
  const sam = await newPlayer(browser, 'Sam', PHONE);
  const kim = await newPlayer(browser, 'Kim', PHONE);
  await createTable(alex.page, 'Views', { deck: 'builtin-standard-52' });
  await joinTable(sam.page, 'Views');
  await joinTable(kim.page, 'Views');
  await alex.page.getByRole('button', { name: 'Table settings' }).click();
  await alex.page.getByLabel('New zone name').fill('Tableau');
  await alex.page.getByLabel('One per player (each player gets their own copy)').check();
  await alex.page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click();
  await alex.page.keyboard.press('Escape');
  await drawInto(sam.page, 'Tableau', true);
  await drawInto(sam.page, 'Your hand');
  await drawInto(alex.page, 'Your hand');

  // Alex views Sam's table
  await alex.page.getByTestId('seat-Sam').click();
  await alex.page.getByRole('button', { name: 'View table' }).click();
  const banner = alex.page.getByRole('region', { name: 'Viewing another table' });
  await expect(banner).toContainText("Viewing Sam's table · 2 of 3");
  await expect(alex.page.locator('.zone-name', { hasText: "Sam's Tableau" })).toBeVisible();
  const samTableau = alex.page.getByTestId('row-Tableau').locator('[data-h]');
  await expect(samTableau).toHaveCount(1);
  // viewed-hand-priority: nothing shown to Alex, so Sam's hand is one slim line with a hidden stack
  await expect(alex.page.getByLabel("Sam's hand", { exact: true })).toContainText("Sam's hand · 1 · none shown to you");
  await expect(alex.page.getByLabel("Sam's hand", { exact: true }).locator('.hidden-count')).toHaveText('+1 hidden');
  await expect(alex.page.getByTestId('seat-Alex')).toContainText('(you)');

  // everyone can tell
  await expect(sam.page.locator('.viewing-pill')).toContainText('Alex');
  // compact-seat-chips: "viewing" is in the chip's accessible name and the seat sheet, not its text
  await expect(kim.page.getByTestId('seat-Alex')).toHaveAttribute('aria-label', /viewing Sam/);
  await expect(kim.page.getByTestId('seat-Alex')).not.toContainText('viewing');
  await kim.page.getByTestId('seat-Alex').click();
  await expect(kim.page.getByTestId('seat-status')).toContainText('viewing Sam');
  await kim.page.keyboard.press('Escape');
  await expect(sam.page.getByTestId('seat-Alex')).toHaveAttribute('aria-label', /viewing you/);

  // permissions: no shuffling Sam's Tableau
  await alex.page.getByRole('button', { name: 'Tableau actions' }).click();
  await expect(alex.page.getByRole('dialog')).toContainText("Sam's Tableau");
  await expect(alex.page.getByRole('button', { name: 'Shuffle' })).toHaveCount(0);
  await expect(alex.page.getByRole('button', { name: 'Flip all' })).toHaveCount(0);
  await alex.page.keyboard.press('Escape');

  // dropping from my hand onto Sam's Tableau passes
  await drag(alex.page, handCards(alex.page).first(), alex.page.getByTestId('row-Tableau'));
  await expect(samTableau).toHaveCount(2);
  await expect(sam.page.getByTestId('row-Tableau').locator('[data-h]')).toHaveCount(2);

  // dragging out of Sam's Tableau into my hand asks Sam
  await drag(alex.page, samTableau.first(), alex.page.getByTestId('row-hand'));
  await expect(sam.page.getByText('Alex wants 1 card from your Tableau')).toBeVisible();
  await sam.page.getByRole('button', { name: 'Decline' }).click();

  // rotate: next is Kim, then wraps to my own table (banner goes away)
  await banner.getByRole('button', { name: 'Next table' }).click();
  await expect(banner).toContainText("Viewing Kim's table · 3 of 3");
  await expect(kim.page.locator('.viewing-pill')).toContainText('Alex');
  await expect(sam.page.locator('.viewing-pill')).toHaveCount(0);
  await banner.getByRole('button', { name: 'Next table' }).click();
  await expect(banner).toHaveCount(0);
  await expect(alex.page.locator('.zone-name', { hasText: /^Tableau$/ })).toBeVisible();
  await expect(kim.page.locator('.viewing-pill')).toHaveCount(0);
  await expect(sam.page.getByTestId('seat-Alex')).not.toHaveAttribute('aria-label', /viewing/);

  // Mine returns from any view
  await alex.page.getByTestId('seat-Kim').click();
  await alex.page.getByRole('button', { name: 'View table' }).click();
  await alex.page.getByRole('button', { name: 'Mine' }).click();
  await expect(alex.page.getByRole('region', { name: 'Viewing another table' })).toHaveCount(0);

  // a spectator rotates through every seat, starting at the first
  const lee = await newPlayer(browser, 'Lee', PHONE);
  await joinTable(lee.page, 'Views', { spectate: true });
  const lb = lee.page.getByRole('region', { name: 'Viewing another table' });
  await expect(lb).toContainText("Viewing Alex's table · 1 of 3");
  await expect(lb.getByRole('button', { name: 'Mine' })).toHaveCount(0);
  await lb.getByRole('button', { name: 'Next table' }).click();
  await expect(lb).toContainText("Viewing Sam's table");
  await expect(lee.page.getByTestId('row-Tableau').locator('[data-h]')).toHaveCount(2);
  await expect(sam.page.locator('.viewing-pill')).toContainText('+1 watching');
  await closeAll(alex.ctx, sam.ctx, kim.ctx, lee.ctx);
});

test('viewed hand: empty names the owner, grows with shown cards (readable, hidden stack), my own hand is a strip', async ({ browser }) => {
  const alex = await newPlayer(browser, 'Alex', PHONE);
  const sam = await newPlayer(browser, 'Sam', PHONE);
  await createTable(alex.page, 'Hands', { deck: 'builtin-standard-52' });
  await joinTable(sam.page, 'Hands');
  await drawInto(alex.page, 'Your hand');

  // Alex views Sam's empty hand
  await alex.page.getByTestId('seat-Sam').click();
  await alex.page.getByRole('button', { name: 'View table' }).click();
  const viewed = alex.page.getByLabel("Sam's hand", { exact: true });
  await expect(viewed).toContainText("Sam's hand is empty");
  await expect(alex.page.getByText('Your hand is empty')).toHaveCount(0);

  // my own hand is a slim strip with small cards, still a drag source
  const mine = alex.page.getByLabel('Your hand');
  await expect(mine).toContainText('Your hand · 1');
  const small = (await handCards(alex.page).first().boundingBox())!.width;
  expect(small).toBeLessThanOrEqual(42);

  // Sam draws 5 and shows two of them to Alex
  for (let i = 0; i < 5; i++) await drawInto(sam.page, 'Your hand');
  await expect(viewed).toContainText("Sam's hand · 5 · none shown to you");
  const pts = await stripCenters(sam.page, 'row-hand');
  await sam.page.touchscreen.tap(pts[0].x, pts[0].y);
  await sam.page.touchscreen.tap(pts[1].x, pts[1].y);
  await sam.page.getByRole('button', { name: 'Actions…' }).click();
  await sam.page.getByRole('button', { name: 'Show to…' }).click();
  await sam.page.getByRole('dialog').getByRole('button', { name: 'Alex' }).click();

  // Alex's view: the viewed hand grows, shown cards first and face up at hand size, the rest one stack
  await expect(viewed).toContainText("Sam's hand · 5 · 2 shown to you");
  await expect(viewed.locator('.card-row [data-h]')).toHaveCount(2);
  await expect(viewed.locator('.card-row .card.face')).toHaveCount(2);
  await expect(viewed.locator('.hidden-count')).toHaveText('+3 hidden');
  const big = (await viewed.locator('.card-row [data-h]').first().boundingBox())!.width;
  expect(big).toBeGreaterThan(small * 1.4);

  // back on my own table the hand is full size again
  await alex.page.getByRole('button', { name: 'Mine' }).click();
  await expect(alex.page.locator('.hand-strip')).toHaveCount(0);
  expect((await handCards(alex.page).first().boundingBox())!.width).toBeGreaterThan(small * 1.4);
  await closeAll(alex.ctx, sam.ctx);
});
