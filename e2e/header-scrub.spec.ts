import { test, expect, type Page } from '@playwright/test';
import { onboard, createTable, draw, PHONE } from './helpers';
import { settle } from './table-helpers';

async function startTable(browser: any, name: string) {
  const ctx = await browser.newContext(PHONE);
  await ctx.addInitScript(() => localStorage.setItem('vct.loupeMode', 'second-finger'));
  const page = await ctx.newPage();
  await onboard(page, 'Alex');
  await createTable(page, name, { deck: 'builtin-standard-52' });
  await draw(page, 'Standard 52', 1);
  // a second spread and a column next to the spread Table, with cards in each
  await page.getByRole('button', { name: 'Table settings' }).click();
  for (const [n, layout] of [['B', 'spread'], ['C', 'column']] as const) {
    await page.getByLabel('New zone name').fill(n);
    await page.getByLabel('New zone layout').selectOption(layout);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.locator(`section.zone[aria-label="${n}"]`)).toHaveCount(1);
  }
  await page.keyboard.press('Escape');
  for (const [to, n] of [['Table', 3], ['B', 3], ['C', 3]] as const) {
    await page.getByTestId('pile-Standard 52').click();
    await page.getByRole('button', { name: 'Draw…' }).click();
    await page.locator('#dcount').fill(String(n));
    await page.locator('#dto').selectOption({ label: to });
    await page.getByRole('button', { name: `Draw ${n}` }).click();
    await expect(page.locator(`section.zone[aria-label="${to}"] [data-h]`)).toHaveCount(n);
  }
  await settle(page);
  return { ctx, page };
}

const header = (page: Page, zone: string) => page.locator(`section.zone[aria-label="${zone}"] .zone-label`);
const centerOf = async (page: Page, zone: string) => {
  const b = (await header(page, zone).boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
const caption = async (page: Page) => ((await page.getByTestId('loupe').locator('.loupe-cap').textContent().catch(() => '')) ?? '').trim();

test('sliding along the zone headers travels zone to zone across a pile, spreads and a column, wraps rows, passes empty zones, and changes nothing (2.1)', async ({ browser }) => {
  const { ctx, page } = await startTable(browser, `Header ${Date.now() % 100000}`);
  const counts = () => page.locator('section.zone').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') + ':' + e.querySelectorAll('[data-h]').length).join('|'));
  const before = await counts();
  const cdp = await page.context().newCDPSession(page);
  const start = await centerOf(page, 'Standard 52');
  const vw = page.viewportSize()!.width;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
  const seen: string[] = [];
  for (let x = start.x + 10; x < vw - 2; x += 10) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: start.y }] });
    const c = await caption(page);
    if (c && seen.at(-1) !== c) seen.push(c);
  }
  // the finger is now against the right edge of the screen: holding it there steps to the next row, again and again
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(420);
    const c = await caption(page);
    if (c && seen.at(-1) !== c) seen.push(c);
    if (/\bC\b/.test(c)) break;
  }
  const names = seen.map((c) => c.replace(/^Row \d+ of \d+ · /, '').replace(/ · \d+$/, ''));
  expect(names[0]).toBe('Standard 52');
  expect(names).toContain('Table');
  expect(names).toContain('B');
  expect(names).toContain('C');
  expect(names).not.toContain('Discard'); // empty: passed over
  expect(seen.some((c) => /^Row \d+ of \d+ · /.test(c))).toBe(true); // the loupe names the row
  expect(names.indexOf('Table')).toBeLessThan(names.indexOf('B'));
  expect(names.indexOf('B')).toBeLessThan(names.indexOf('C'));

  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.getByTestId('loupe')).toHaveCount(0);
  expect(await counts()).toBe(before); // nothing moved
  await expect(page.getByRole('region', { name: 'Arranging zones' })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0); // a slide does not open the zone's actions
  await ctx.close();
});

test('a tap on a header still opens the zone actions (2.1)', async ({ browser }) => {
  const { ctx, page } = await startTable(browser, `Header tap ${Date.now() % 100000}`);
  await page.getByRole('button', { name: 'Table actions' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await ctx.close();
});

test('pausing on a header shows that zone card\'s details in the loupe (2.1)', async ({ browser }) => {
  const { ctx, page } = await startTable(browser, `Header pause ${Date.now() % 100000}`);
  const start = await centerOf(page, 'Table');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + 12, y: start.y }] });
  await expect(page.getByTestId('loupe')).toBeVisible();
  await expect(page.getByTestId('loupe-details')).toHaveCount(0);
  await page.waitForTimeout(450);
  await expect(page.getByTestId('loupe-details')).toBeVisible();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await ctx.close();
});

test('sliding down from a header into the cards starts that zone\'s own scrub: along a spread, down a column with nothing picked up (3.1)', async ({ browser }) => {
  const { ctx, page } = await startTable(browser, `Header enter ${Date.now() % 100000}`);
  const cdp = await page.context().newCDPSession(page);

  // a spread: from its header down onto the cards, then sideways; the loupe follows the cards one by one
  const row = (await page.getByTestId('row-Table').boundingBox())!;
  const hd = await centerOf(page, 'Table');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [hd] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: hd.x + 12, y: hd.y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: hd.x + 12, y: row.y + 20 }] });
  await expect(page.getByTestId('row-Table').locator('.card.focused')).toHaveCount(1);
  const first = await page.getByTestId('row-Table').locator('.card.focused').getAttribute('data-h');
  const lastCard = (await page.getByTestId('row-Table').locator('[data-h]').last().boundingBox())!;
  for (let x = hd.x + 20; x < lastCard.x + lastCard.width - 10; x += 6) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: row.y + 20 }] });
  await expect(page.getByTestId('row-Table').locator('.card.focused')).toHaveCount(1);
  expect(await page.getByTestId('row-Table').locator('.card.focused').getAttribute('data-h')).not.toBe(first);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.getByTestId('loupe')).toHaveCount(0);

  // a column: from its header down; vertical scrub, no drag
  const colHeader = await centerOf(page, 'C');
  const colBox = (await page.locator('section.zone[aria-label="C"] .column-cards').boundingBox())!;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [colHeader] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: colHeader.x + 10, y: colHeader.y }] }); // a sideways nudge starts the header scrub
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: colHeader.x + 10, y: colBox.y + 10 }] });
  await expect(page.locator('section.zone[aria-label="C"] .card.focused')).toHaveCount(1);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: colHeader.x + 1, y: colBox.y + colBox.height - 10 }] });
  await expect(page.locator('.drag-ghost')).toHaveCount(0);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('section.zone[aria-label="C"] [data-h]')).toHaveCount(3); // nothing was picked up
  await ctx.close();
});

for (const scheme of ['light', 'dark'] as const) {
  test(`the loupe is readable during a header scrub in ${scheme} mode (4.1)`, async ({ browser }) => {
    const { lowContrast } = await import('./contrast');
    const ctx = await browser.newContext({ ...PHONE, colorScheme: scheme });
    await ctx.addInitScript(() => localStorage.setItem('vct.loupeMode', 'second-finger'));
    const page = await ctx.newPage();
    await onboard(page, 'Alex');
    await createTable(page, `Header ${scheme} ${Date.now() % 100000}`, { deck: 'builtin-standard-52' });
    await draw(page, 'Standard 52', 3);
    const start = await centerOf(page, 'Standard 52');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + 12, y: start.y }] });
    await expect(page.getByTestId('loupe')).toBeVisible();
    await page.waitForTimeout(450);
    await expect(page.getByTestId('loupe-details')).toBeVisible();
    const issues = await lowContrast(page);
    expect(issues, issues.map((i) => `${i.kind} ${i.element} "${i.text}" ${i.ratio} < ${i.required}`).join('\n')).toEqual([]);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await ctx.close();
  });
}
