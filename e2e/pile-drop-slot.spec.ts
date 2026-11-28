import { test, expect, type Page } from '@playwright/test';
import { onboard, createTable, draw, PHONE } from './helpers';
import { stripCenters, settle } from './table-helpers';
import { lowContrast } from './contrast';

const deck = (page: Page) => page.getByTestId('pile-Standard 52');
const centerOf = (b: { x: number; y: number; width: number; height: number }) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
const pileCount = async (page: Page) => Number(await deck(page).locator('.pile-count').innerText());

async function start(browser: any, name: string, scheme: 'light' | 'dark' = 'light') {
  const ctx = await browser.newContext({ ...PHONE, colorScheme: scheme });
  const page = await ctx.newPage();
  await onboard(page, 'Alex');
  await createTable(page, `${name} ${Date.now() % 100000}`, { deck: 'builtin-standard-52' });
  await draw(page, 'Standard 52', 5);
  await expect(page.getByTestId('row-hand').locator('[data-h]')).toHaveCount(5);
  return { ctx, page };
}

/** The faces of the deck from top to bottom: card names for the known (face-up) ones, 'back' for the rest. */
async function deckOrder(page: Page): Promise<string[]> {
  await deck(page).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Fan out' }).click();
  const labels = await page.getByRole('dialog').locator('[data-h]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  return labels.map((l) => (/face-down/i.test(l) ? 'back' : l));
}

/**
 * Carries the first hand card out of the hand and over the deck. `hold` rests there until the pile fans out;
 * `after` then moves the finger (dx per step, ms between steps) before the release.
 */
async function carryToDeck(page: Page, opts: { hold: boolean; after?: { dx: number; ms: number; steps: number } }) {
  const hand = (await stripCenters(page, 'row-hand'))[0];
  const target = centerOf((await deck(page).boundingBox())!);
  const cdp = await page.context().newCDPSession(page);
  const t = (type: string, p?: { x: number; y: number }) => cdp.send('Input.dispatchTouchEvent', { type: type as any, touchPoints: p ? [{ ...p, id: 1 }] : [] });
  await t('touchStart', hand);
  await page.waitForTimeout(20);
  await t('touchMove', { x: hand.x, y: hand.y - 16 });
  await page.waitForTimeout(20);
  await t('touchMove', { x: hand.x, y: hand.y - 40 });
  for (let i = 1; i <= 8; i++) {
    await page.waitForTimeout(15);
    await t('touchMove', { x: hand.x + ((target.x - hand.x) * i) / 8, y: hand.y - 40 + ((target.y - hand.y + 40) * i) / 8 });
  }
  let at = target;
  if (opts.hold) {
    await page.waitForTimeout(450);
    await expect(page.getByTestId('pile-fan-Standard 52')).toBeVisible();
    if (opts.after) {
      if (opts.after.ms === 0) {
        // a fast sweep: the moves reach the page within a few milliseconds of each other
        const pts = Array.from({ length: opts.after.steps }, (_, i) => ({ x: at.x + opts.after!.dx * (i + 1), y: at.y }));
        await Promise.all(pts.map((p) => t('touchMove', p)));
        at = pts[pts.length - 1];
      } else {
        for (let i = 0; i < opts.after.steps; i++) {
          at = { x: at.x + opts.after.dx, y: at.y };
          await page.waitForTimeout(opts.after.ms);
          await t('touchMove', at);
        }
      }
      await page.waitForTimeout(40);
    }
  }
  await t('touchEnd');
  await page.waitForTimeout(150);
  await settle(page);
}

test('holding a carried card over a pile fans it out; a drop without moving lands on top; slow and fast travel choose the depth; a quick pass drops on top (3.1)', async ({ browser }) => {
  test.setTimeout(120_000);
  const { ctx, page } = await start(browser, 'Pile drop slot');
  const total = await pileCount(page);

  // 1. hold until it fans out, release without moving: on top
  await carryToDeck(page, { hold: true });
  expect(await pileCount(page)).toBe(total + 1);
  let order = await deckOrder(page);
  expect(order[0]).not.toBe('back');
  expect(order.filter((l) => l !== 'back')).toHaveLength(1);
  const first = order[0];

  // 2. hold, then move slowly (24 px at 0.05 px/ms): a slot a little way down, one at a time
  await carryToDeck(page, { hold: true, after: { dx: 3, ms: 60, steps: 8 } });
  order = await deckOrder(page);
  const named = order.map((l, i) => (l === 'back' ? -1 : i)).filter((i) => i >= 0);
  expect(named).toHaveLength(2);
  expect(order[0], JSON.stringify(named)).toBe(first); // the earlier card stays on top
  expect(named[1]).toBeGreaterThanOrEqual(1);
  expect(named[1]).toBeLessThanOrEqual(5);

  // 3. hold, then a fast sweep: deep in the pile
  await carryToDeck(page, { hold: true, after: { dx: 15, ms: 20, steps: 8 } }); // a quick 120 px sweep, still over the pile's zone
  order = await deckOrder(page);
  const named3 = order.map((l, i) => (l === 'back' ? -1 : i)).filter((i) => i >= 0);
  expect(named3).toHaveLength(3);
  // the travel took the slot a long way down (the gain itself is covered by unit tests; how fast events reach the page varies by machine)
  expect(named3[2], JSON.stringify(named3)).toBeGreaterThan(named[1] + 4);

  // 4. a quick pass without holding: on top
  await carryToDeck(page, { hold: false });
  order = await deckOrder(page);
  const named4 = order.map((l, i) => (l === 'back' ? -1 : i)).filter((i) => i >= 0);
  expect(named4).toHaveLength(4);
  expect(named4[0]).toBe(0);
  expect(await pileCount(page)).toBe(total + 4);
  await ctx.close();
});

test('the pile collapses after the drop', async ({ browser }) => {
  const { ctx, page } = await start(browser, 'Pile drop collapse');
  await carryToDeck(page, { hold: true });
  await expect(page.getByTestId('pile-fan-Standard 52')).toHaveCount(0);
  await ctx.close();
});

for (const scheme of ['light', 'dark'] as const) {
  test(`the fanned pile with its drop gap is readable in ${scheme} mode (3.1)`, async ({ browser }) => {
    const { ctx, page } = await start(browser, `Pile drop ${scheme}`, scheme);
    const hand = (await stripCenters(page, 'row-hand'))[0];
    const target = centerOf((await deck(page).boundingBox())!);
    const cdp = await page.context().newCDPSession(page);
    const t = (type: string, p?: { x: number; y: number }) => cdp.send('Input.dispatchTouchEvent', { type: type as any, touchPoints: p ? [{ ...p, id: 1 }] : [] });
    await t('touchStart', hand);
    await t('touchMove', { x: hand.x, y: hand.y - 16 });
    await t('touchMove', { x: hand.x, y: hand.y - 40 });
    for (let i = 1; i <= 8; i++) {
      await page.waitForTimeout(15);
      await t('touchMove', { x: hand.x + ((target.x - hand.x) * i) / 8, y: hand.y - 40 + ((target.y - hand.y + 40) * i) / 8 });
    }
    await page.waitForTimeout(450);
    await expect(page.getByTestId('pile-fan-Standard 52')).toBeVisible();
    const issues = await lowContrast(page);
    expect(issues, issues.map((i) => `${i.kind} ${i.element} "${i.text}" ${i.ratio} < ${i.required}`).join('\n')).toEqual([]);
    await t('touchEnd');
    await ctx.close();
  });
}
