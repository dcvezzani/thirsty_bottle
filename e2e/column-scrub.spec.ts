import { test, expect } from '@playwright/test';
import { onboard, createTable, draw, PHONE } from './helpers';
import { settle } from './table-helpers';

test('scrubbing a column: the card in the loupe is the card under the finger, down and back up, inner cards included (2.1)', async ({ browser }) => {
  const ctx = await browser.newContext(PHONE);
  await ctx.addInitScript(() => localStorage.setItem('vct.loupeMode', 'second-finger'));
  const page = await ctx.newPage();
  await onboard(page, 'Alex');
  await createTable(page, `Column ${Date.now() % 100000}`, { deck: 'builtin-standard-52' });
  await draw(page, 'Standard 52', 1);
  await page.getByRole('button', { name: 'Table settings' }).click();
  await page.getByLabel('New zone name').fill('C');
  await page.getByLabel('New zone layout').selectOption('column');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('section.zone[aria-label="C"]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await page.getByTestId('pile-Standard 52').click();
  await page.getByRole('button', { name: 'Draw…' }).click();
  await page.locator('#dcount').fill('12');
  await page.locator('#dto').selectOption({ label: 'C' });
  await page.getByRole('button', { name: 'Draw 12' }).click();
  await expect(page.locator('section.zone[aria-label="C"] [data-h]')).toHaveCount(12);
  await settle(page);

  await page.locator('section.zone[aria-label="C"]').scrollIntoViewIfNeeded();
  await settle(page);
  const col = (await page.locator('section.zone[aria-label="C"] .column-cards').boundingBox())!;
  const vh = page.viewportSize()!.height;
  expect(col.y + col.height, 'the column is on screen').toBeLessThan(vh - 60);
  const x = col.x + col.width / 2;
  const cdp = await page.context().newCDPSession(page);
  if (process.env.E2E_THROTTLE) await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.E2E_THROTTLE) });
  const move = (y: number) => cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
  const underFinger = (y: number) => page.evaluate(({ x, y }) => {
    // the card drawn at the finger, ignoring the loupe (which never covers the column)
    const els = document.elementsFromPoint(x, y);
    const c = els.find((e) => e.closest('[data-h]') && !e.closest('.loupe'))?.closest('[data-h]');
    return c?.getAttribute('data-h') ?? null;
  }, { x, y });
  const shown = () => page.getByTestId('loupe').locator('[data-h]').first().getAttribute('data-h');

  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: col.y + 14 }] });
  await move(col.y + 28); // a vertical nudge past the slop starts the scrub
  const mismatches: string[] = [];
  // the column redraws (and its cards glide) a frame or more after a move: wait for that before comparing, so a slow machine
  // does not read a layout that is still on its way
  const settled = () =>
    page.waitForFunction(
      () =>
        new Promise<boolean>((res) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() =>
              res(
                document
                  .getAnimations()
                  .filter((a) => a.playState === 'running')
                  .every((a) => !(a.effect as KeyframeEffect | null)?.target?.closest?.('[data-h]')),
              ),
            ),
          ),
        ),
      undefined,
      { timeout: 5000, polling: 20 },
    );
  const check = async (y: number, tag: string) => {
    await settled();
    const [a, b] = [await shown(), await underFinger(y)];
    if (a !== b) mismatches.push(`${tag} y=${Math.round(y)} loupe=${a} under=${b}`);
  };
  // the finger arrives on the first card, then slides down the whole column and back up in small steps
  await expect(page.getByTestId('loupe')).toBeVisible();
  const step = 4;
  const bottom = col.y + col.height - 4;
  for (let y = col.y + 28; y < bottom; y += step) {
    await move(y);
    await check(y, 'down');
  }
  for (let y = bottom; y > col.y + 28; y -= step) {
    await move(y);
    await check(y, 'up');
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  // the old behaviour mismatched at dozens of positions; allow a stray one or two where a card boundary sits exactly at the finger
  expect(mismatches.length, mismatches.slice(0, 8).join('\n')).toBeLessThanOrEqual(2);
  await expect(page.locator('section.zone[aria-label="C"] [data-h]')).toHaveCount(12); // nothing moved
  await ctx.close();
});
