import { test, expect, type Page } from '@playwright/test';
import { onboard, createTable, PHONE } from './helpers';
import { lowContrast } from './contrast';

async function start(browser: any, name: string, mode: 'second-finger' | 'stay' = 'second-finger', scheme: 'light' | 'dark' = 'light') {
  const ctx = await browser.newContext({ ...PHONE, colorScheme: scheme });
  await ctx.addInitScript((m: string) => localStorage.setItem('vct.loupeMode', m), mode);
  const page = await ctx.newPage();
  await onboard(page, 'Alex');
  await createTable(page, `${name} ${Date.now() % 100000}`, { deck: 'builtin-standard-52' });
  const pile = page.getByTestId('pile-Standard 52');
  await expect(pile).toBeVisible();
  return { ctx, page, pile };
}

const centerOf = (b: { x: number; y: number; width: number; height: number }) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
const f = (p: { x: number; y: number }, id = 1) => ({ ...p, id });

async function scrubOver(page: Page, pile: ReturnType<Page['getByTestId']>) {
  const c = centerOf((await pile.boundingBox())!);
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: string, points: { x: number; y: number; id: number }[]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  await touch('touchStart', [f(c)]);
  await touch('touchMove', [f({ x: c.x + 12, y: c.y })]);
  await touch('touchMove', [f({ x: c.x + 90, y: c.y })]);
  return { c, touch };
}

test('sliding across a pile fans it out in place and scrubs it; it collapses on release; a pull still takes the top card (3.1)', async ({ browser }) => {
  const { ctx, page, pile } = await start(browser, 'Pile scrub');
  const before = await pile.locator('.pile-count').textContent();
  const { c, touch } = await scrubOver(page, pile);
  const loupe = page.getByTestId('loupe');
  await expect(loupe).toBeVisible();
  await expect(page.getByTestId('pile-fan-Standard 52')).toBeVisible();
  // the fan holds every card of the pile
  await expect(page.getByTestId('fan-Standard 52').locator('[data-h]')).toHaveCount(52);
  await touch('touchMove', [f({ x: c.x + 160, y: c.y })]);
  await touch('touchEnd', []);
  await expect(loupe).toHaveCount(0);
  await expect(page.getByTestId('pile-fan-Standard 52')).toHaveCount(0);
  await expect(pile.locator('.pile-count')).toHaveText(before!); // nothing changed

  // a pull (up) takes the top card as before: no loupe, no fan
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [f(c)] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [f({ x: c.x + 2, y: c.y - 14 })] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [f({ x: c.x + 2, y: c.y - 60 })] });
  await expect(page.getByTestId('loupe')).toHaveCount(0);
  await expect(page.getByTestId('pile-fan-Standard 52')).toHaveCount(0);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await ctx.close();
});

test('See face-down: a second finger on the chip shows faces and logs one peek; it is off again for the next scrub and cleared when the scrub ends (3.1)', async ({ browser }) => {
  const { ctx, page, pile } = await start(browser, 'Face down');
  const { c, touch } = await scrubOver(page, pile);
  const loupe = page.getByTestId('loupe');
  await expect(loupe).toBeVisible();
  await expect(loupe).toHaveAttribute('aria-label', 'Face-down card');
  const chip = page.getByTestId('see-face-down');
  await expect(chip).toBeVisible();
  await expect(chip).toHaveAttribute('aria-pressed', 'false');

  // the second finger taps the chip while the first keeps scrubbing
  const at = centerOf((await chip.boundingBox())!);
  await touch('touchStart', [f({ x: c.x + 90, y: c.y }), f(at, 2)]);
  await page.waitForTimeout(60);
  await touch('touchEnd', [f(at, 2)]);
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect(loupe).not.toHaveAttribute('aria-label', 'Face-down card'); // the face is shown now
  await touch('touchMove', [f({ x: c.x + 140, y: c.y })]);
  await expect(loupe).not.toHaveAttribute('aria-label', 'Face-down card');

  // one peek line in the log (others see "Alex peeked at 52 cards in Standard 52")
  await touch('touchEnd', []);
  await expect(loupe).toHaveCount(0);
  await page.getByRole('button', { name: 'Log', exact: true }).click();
  await expect(page.getByLabel("Table log").locator("li").filter({ hasText: /You peeked at / })).toHaveCount(1);
  await page.keyboard.press('Escape');

  // a new scrub starts with the chip off, and the cards are face-down for me again
  const second = await scrubOver(page, pile);
  await expect(page.getByTestId('loupe')).toHaveAttribute('aria-label', 'Face-down card');
  await expect(page.getByTestId('see-face-down')).toHaveAttribute('aria-pressed', 'false');
  await second.touch('touchEnd', []);
  await ctx.close();
});

test('stay open: the loupe keeps a See face-down button, and it clears when the viewing ends (3.1)', async ({ browser }) => {
  const { ctx, page, pile } = await start(browser, 'Face down stay', 'stay');
  const { touch } = await scrubOver(page, pile);
  await touch('touchEnd', []);
  const loupe = page.getByTestId('loupe');
  await expect(loupe).toBeVisible(); // stays open after release
  const button = page.getByTestId('see-face-down');
  await expect(button).toBeVisible();
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(loupe).not.toHaveAttribute('aria-label', 'Face-down card');
  await page.getByRole('button', { name: 'Close loupe' }).click();
  await expect(loupe).toHaveCount(0);
  // viewing again: off, and face-down
  const again = await scrubOver(page, pile);
  await again.touch('touchEnd', []);
  await expect(page.getByTestId('see-face-down')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('loupe')).toHaveAttribute('aria-label', 'Face-down card');
  await ctx.close();
});

for (const scheme of ['light', 'dark'] as const) {
  test(`the chip and the fanned pile are readable in ${scheme} mode (3.1)`, async ({ browser }) => {
    const { ctx, page, pile } = await start(browser, `Chip ${scheme}`, 'second-finger', scheme);
    await scrubOver(page, pile);
    await expect(page.getByTestId('see-face-down')).toBeVisible();
    const issues = await lowContrast(page);
    expect(issues, issues.map((i) => `${i.kind} ${i.element} "${i.text}" ${i.ratio} < ${i.required}`).join('\n')).toEqual([]);
    await ctx.close();
  });
}

test('a 52-card pile can be scrubbed to any card: slow movement steps one card at a time, a fast sweep covers the pile (3.1)', async ({ browser }) => {
  const { ctx, page, pile } = await start(browser, 'Pile granularity');
  const { c, touch } = await scrubOver(page, pile);
  const fan = page.getByTestId('pile-fan-Standard 52');
  await expect(fan).toBeVisible();
  await page.waitForTimeout(300); // the zone has widened
  expect((await fan.boundingBox())!.width).toBeGreaterThan(180); // not squeezed into the pile's own width
  const order = await page.getByTestId('fan-Standard 52').locator('[data-h]').evaluateAll((els) => els.map((e) => e.getAttribute('data-h')));
  const shown = async () => order.indexOf(await page.getByTestId('loupe').locator('[data-h]').first().getAttribute('data-h'));
  let x = c.x + 90; // where scrubOver left the finger
  const moveBy = async (dx: number, stepMs: number) => {
    x += dx;
    if (stepMs) await page.waitForTimeout(stepMs);
    await touch('touchMove', [f({ x, y: c.y })]);
  };

  // slow: 8 steps of 3 px, 60 ms apart (24 px at 0.05 px/ms) moves about two cards, one at a time
  await page.waitForTimeout(100);
  const a = await shown();
  const slowSeen: number[] = [];
  for (let i = 0; i < 8; i++) {
    await moveBy(3, 60);
    slowSeen.push(await shown());
  }
  const b = slowSeen[slowSeen.length - 1];
  expect(b - a, JSON.stringify(slowSeen)).toBeGreaterThanOrEqual(1);
  expect(b - a).toBeLessThanOrEqual(4);
  expect(slowSeen.every((v, i) => v - (i ? slowSeen[i - 1] : a) <= 1), JSON.stringify(slowSeen)).toBe(true); // never skips a card

  // a broad sweep of 300 px takes the scrub well into the pile (how far depends on its speed)
  for (let i = 0; i < 10; i++) await moveBy(30, 0);
  await page.waitForTimeout(40);
  const swept = await shown();
  expect(swept).toBeGreaterThan(20);

  // slow again: stepping back 18 px (0.05 px/ms) moves about one or two cards, not a jump
  await page.waitForTimeout(100);
  const before = await shown();
  for (let i = 0; i < 6; i++) await moveBy(-3, 60);
  const after = await shown();
  expect(before - after).toBeGreaterThanOrEqual(1);
  expect(before - after).toBeLessThanOrEqual(3);
  await touch('touchEnd', []);
  await ctx.close();
});
