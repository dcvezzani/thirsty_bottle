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
  // shared-hand-dock: nothing shown to Alex, so Sam's column shows a badge and the hidden stack
  const samCol = alex.page.getByTestId('viewed-col');
  await expect(samCol).toContainText('Sam · 1 · none shown');
  await expect(samCol.locator('.card-row [data-h]')).toHaveCount(1); // fanned-viewed-hand: the whole hand is fanned
  await expect(samCol.locator('.card-row .card.back')).toHaveCount(1);
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

test('hand dock: constant height, their hand focused by default, sliding focuses and it sticks, shown cards, carry, rotate, spectator', async ({ browser }) => {
  const alex = await newPlayer(browser, 'Alex', PHONE);
  const sam = await newPlayer(browser, 'Sam', PHONE);
  const kim = await newPlayer(browser, 'Kim', PHONE);
  await createTable(alex.page, 'Dock', { deck: 'builtin-standard-52' });
  await joinTable(sam.page, 'Dock');
  await joinTable(kim.page, 'Dock');
  for (let i = 0; i < 5; i++) await drawInto(alex.page, 'Your hand');
  const ownH = (await alex.page.locator('.hand-area').boundingBox())!.height;

  // Alex views Sam's empty hand: the dock is as tall as my own hand area; their hand is the wide column
  await alex.page.getByTestId('seat-Sam').click();
  await alex.page.getByRole('button', { name: 'View table' }).click();
  const dock = alex.page.getByTestId('hand-dock');
  const samCol = alex.page.getByTestId('viewed-col');
  const myCol = alex.page.getByTestId('mine-col');
  const width = async (l: Locator) => (await l.boundingBox())!.width;
  const boardH = async () => (await alex.page.locator('.board').boundingBox())!.height;
  await expect(samCol).toContainText("Sam's hand is empty");
  await expect(samCol).toContainText('Sam · empty');
  await expect(alex.page.getByText('Your hand is empty')).toHaveCount(0);
  await expect(myCol).toContainText('You · 5');
  expect(Math.abs((await dock.boundingBox())!.height - ownH)).toBeLessThanOrEqual(1);
  await expect(samCol).toHaveClass(/focused/);
  expect(await width(samCol)).toBeGreaterThan((await width(myCol)) * 1.5);
  const board0 = await boardH();

  // Sam draws 5 and shows two to Alex: shown cards first, face up; the rest one stack; same dock height, board unmoved
  for (let i = 0; i < 5; i++) await drawInto(sam.page, 'Your hand');
  await expect(samCol).toContainText('Sam · 5 · none shown');
  const show = async (i: number) => {
    const pts = await stripCenters(sam.page, 'row-hand');
    await sam.page.touchscreen.tap(pts[i].x, pts[i].y);
    await sam.page.getByRole('button', { name: 'Actions…' }).click();
    await sam.page.getByRole('button', { name: 'Show to…' }).click();
    await sam.page.getByRole('dialog').getByRole('button', { name: 'Alex' }).click();
  };
  await show(0);
  await show(1);
  await expect(samCol).toContainText('Sam · 5 · 2 shown');
  await expect(samCol.locator('.card-row .card.face')).toHaveCount(2);
  await expect(samCol.locator('.card-row [data-h]')).toHaveCount(5); // all five fanned: two shown first, three backs
  await expect(samCol.locator('.card-row .card.back')).toHaveCount(3);
  expect(Math.abs((await dock.boundingBox())!.height - ownH)).toBeLessThanOrEqual(1);
  expect(await boardH()).toBe(board0);

  // sliding along my narrow hand focuses it, and it stays after release
  const slide = async (testId: string) => {
    const b = (await alex.page.getByTestId(testId).boundingBox())!;
    const y = b.y + b.height * 0.55;
    await touchPath(alex.page, line({ x: b.x + 18, y }, { x: b.x + Math.min(b.width - 8, 70), y }, 8));
    await settle(alex.page);
  };
  await slide('row-hand');
  await expect(myCol).toHaveClass(/focused/);
  await expect(samCol).toHaveClass(/narrow/);
  expect(await width(myCol)).toBeGreaterThan((await width(samCol)) * 1.5);
  await alex.page.waitForTimeout(400);
  await expect(myCol).toHaveClass(/focused/);

  // a tap on a card in the narrow column selects it and leaves the focus alone
  const shown = samCol.locator('.card-row .card.face').first();
  const sb = (await shown.boundingBox())!;
  await alex.page.touchscreen.tap(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await expect(alex.page.getByTestId('selection-count')).toBeVisible();
  await expect(myCol).toHaveClass(/focused/);
  await alex.page.getByRole('button', { name: 'Clear selection' }).click();

  // a card shown while my hand is focused: Sam's narrow column pulses and counts it, focus unchanged
  await show(2);
  await expect(samCol).toHaveClass(/pulse/);
  await expect(samCol).toContainText('Sam · 5 · 3 shown');
  await expect(myCol).toHaveClass(/focused/);

  // carrying a card from my hand over Sam's narrow column focuses it; dropping passes the card
  const a = await center(handCards(alex.page).first());
  const b = await center(samCol);
  await touchPath(alex.page, [a, { x: a.x, y: a.y - 15 }, ...line({ x: a.x, y: a.y - 15 }, b, 12)]);
  await settle(alex.page);
  await expect(samCol).toHaveClass(/focused/);
  await expect(samCol).toContainText('Sam · 6 · 3 shown');
  await expect(myCol).toContainText('You · 4');

  // sliding back over my column, then rotating to Kim resets the focus to their hand
  await slide('row-hand');
  await expect(myCol).toHaveClass(/focused/);
  await alex.page.getByRole('region', { name: 'Viewing another table' }).getByRole('button', { name: 'Next table' }).click();
  await expect(alex.page.getByRole('region', { name: 'Viewing another table' })).toContainText("Viewing Kim's table");
  await expect(alex.page.getByTestId('viewed-col')).toHaveClass(/focused/);
  expect(Math.abs((await alex.page.getByTestId('hand-dock').boundingBox())!.height - ownH)).toBeLessThanOrEqual(1);

  // a spectator gets one full-width column
  const lee = await newPlayer(browser, 'Lee', PHONE);
  await joinTable(lee.page, 'Dock', { spectate: true });
  await expect(lee.page.getByTestId('viewed-col')).toHaveClass(/solo/);
  await expect(lee.page.getByTestId('mine-col')).toHaveCount(0);
  await closeAll(alex.ctx, sam.ctx, kim.ctx, lee.ctx);
});

test('fanned viewed hand: every card is fanned, shown first; a back can be picked blindly; open hands takes at once', async ({ browser }) => {
  const alex = await newPlayer(browser, 'Alex', PHONE);
  const sam = await newPlayer(browser, 'Sam', PHONE);
  await createTable(alex.page, 'Fan', { deck: 'builtin-standard-52' });
  await joinTable(sam.page, 'Fan');
  for (let i = 0; i < 5; i++) await drawInto(sam.page, 'Your hand');

  // Alex views Sam: nothing shown yet, but all five are fanned as backs
  await alex.page.getByTestId('seat-Sam').click();
  await alex.page.getByRole('button', { name: 'View table' }).click();
  const samCol = alex.page.getByTestId('viewed-col');
  const fan = samCol.locator('.card-row [data-h]');
  await expect(samCol).toContainText('Sam · 5 · none shown');
  await expect(fan).toHaveCount(5);
  await expect(samCol.locator('.card-row .card.back')).toHaveCount(5);

  // Sam shows one card: it comes first and face up, the other four stay backs in the same fan
  const pts = await stripCenters(sam.page, 'row-hand');
  await sam.page.touchscreen.tap(pts[2].x, pts[2].y);
  await sam.page.getByRole('button', { name: 'Actions…' }).click();
  await sam.page.getByRole('button', { name: 'Show to…' }).click();
  await sam.page.getByRole('dialog').getByRole('button', { name: 'Alex' }).click();
  await expect(samCol).toContainText('Sam · 5 · 1 shown');
  await expect(fan).toHaveCount(5);
  await expect(fan.first()).toHaveClass(/face/);
  await expect(samCol.locator('.card-row .card.back')).toHaveCount(4);

  // pick a back blindly: the toolbar offers Ask to take (no Flip), and Sam is asked for one card
  const backs = await stripCenters(alex.page, 'row-viewed-hand');
  await alex.page.touchscreen.tap(backs[3].x, backs[3].y);
  const bar = alex.page.getByRole('toolbar', { name: 'Selected cards' });
  await expect(bar.getByRole('button', { name: 'Ask to take' })).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Flip' })).toHaveCount(0);
  await bar.getByRole('button', { name: 'Ask to take' }).click();
  await expect(sam.page.getByText('Alex wants 1 card from your hand')).toBeVisible();
  await expect(handCards(alex.page)).toHaveCount(0); // nothing moved before Sam answers
  await sam.page.getByRole('button', { name: 'Allow' }).click();
  await expect(handCards(alex.page)).toHaveCount(1);
  await expect(samCol).toContainText('Sam · 4 · 1 shown');

  // open hands: dragging a back out of Sam's fan onto my own hand takes it at once
  await alex.page.getByRole('button', { name: 'Table settings' }).click();
  await alex.page.getByLabel(/Open hands/).click(); // the checkbox follows the server's answer
  await expect(alex.page.getByLabel(/Open hands/)).toBeChecked();
  await alex.page.keyboard.press('Escape');
  await drag(alex.page, fan.last(), alex.page.getByTestId('row-hand'));
  await expect(handCards(alex.page)).toHaveCount(2);
  await expect(samCol).toContainText('Sam · 3 · 1 shown');
  await closeAll(alex.ctx, sam.ctx);
});
