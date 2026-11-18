import { test, expect, type Page } from '@playwright/test';
import { newPlayer, createTable, joinTable, PHONE } from './helpers';

async function openDraw(page: Page) {
  await page.getByTestId('pile-Standard 52').click();
  await page.getByRole('button', { name: 'Draw…' }).click();
}

test('draw: clear the count and type 12 on a phone; out-of-range clamps; empty disables (2.1)', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex', PHONE);
  await createTable(page, 'Count draw', { deck: 'builtin-standard-52' });
  await openDraw(page);
  const field = page.locator('#dcount');
  await field.tap();
  await page.keyboard.press('Backspace');
  await expect(field).toHaveValue('');
  await expect(page.getByRole('button', { name: /^Draw/ }).last()).toBeDisabled();
  await page.keyboard.type('12');
  await expect(field).toHaveValue('12');
  await expect(page.getByLabel('How many (slider)')).toHaveValue('12');
  // out of range clamps when leaving the field
  await field.fill('99');
  await field.blur();
  await expect(field).toHaveValue('52');
  await field.fill('12');
  await page.getByRole('button', { name: 'Draw 12' }).click();
  await expect(page.getByTestId('row-hand').locator('[data-h]')).toHaveCount(12);
  await ctx.close();
});

test('deal: set the count with the slider; maximum follows the selected seats (2.1)', async ({ browser }) => {
  const { ctx: c1, page: alex } = await newPlayer(browser, 'Alex', PHONE);
  await createTable(alex, 'Count seats', { deck: 'builtin-standard-52' });
  const { ctx: c2, page: sam } = await newPlayer(browser, 'Sam', PHONE);
  await joinTable(sam, 'Count seats');
  await alex.getByTestId('pile-Standard 52').click();
  await alex.getByRole('button', { name: 'Deal…' }).click();
  const slider = alex.getByLabel('Cards to each seat (slider)');
  await expect(slider).toHaveAttribute('max', '26');
  await expect(alex.locator('#dealn')).toHaveValue('26');
  // deselect Sam: one seat → max 52; reselect → back to 26 and the value is clamped
  await alex.getByRole('dialog').getByRole('checkbox', { name: 'Sam' }).click();
  await expect(slider).toHaveAttribute('max', '52');
  await slider.focus();
  await alex.keyboard.press('End');
  await expect(alex.locator('#dealn')).toHaveValue('52');
  await alex.getByRole('dialog').getByRole('checkbox', { name: 'Sam' }).click();
  await expect(slider).toHaveAttribute('max', '26');
  await expect(alex.locator('#dealn')).toHaveValue('26');
  // slider via keyboard: Home → 1, two steps right → 3
  await slider.focus();
  await alex.keyboard.press('Home');
  await alex.keyboard.press('ArrowRight');
  await alex.keyboard.press('ArrowRight');
  await expect(alex.locator('#dealn')).toHaveValue('3');
  await alex.getByRole('button', { name: 'Deal 3 to 2 seats' }).click();
  await expect(alex.getByTestId('row-hand').locator('[data-h]')).toHaveCount(3);
  await expect(sam.getByTestId('row-hand').locator('[data-h]')).toHaveCount(3);
  await Promise.all([c1.close(), c2.close()]);
});

test('peek and cut use the count control with pile-based limits (2.2)', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex', PHONE);
  await createTable(page, 'Count peek', { deck: 'builtin-standard-52' });
  await page.getByTestId('pile-Standard 52').click();
  await page.locator('#peekn').fill('3');
  await page.getByRole('button', { name: 'Peek', exact: true }).click();
  await page.getByRole('button', { name: 'Log', exact: true }).click();
  const entry = await page.getByLabel('Table log').locator('li').first().innerText();
  expect(entry).toMatch(/You peeked at [^,]+, [^,]+, [^,]+$/);
  await page.getByRole('button', { name: 'Log', exact: true }).click();
  await page.getByTestId('pile-Standard 52').click();
  const cut = page.locator('#cutn');
  await expect(page.getByRole('button', { name: 'Cut', exact: true })).toBeDisabled();
  await cut.fill('99');
  await cut.blur();
  await expect(cut).toHaveValue('51');
  await expect(page.getByLabel('Cut depth (slider)')).toHaveAttribute('max', '51');
  await cut.fill('20');
  await page.getByRole('button', { name: 'Cut', exact: true }).click();
  await page.getByRole('button', { name: 'Log', exact: true }).click();
  await expect(page.getByLabel('Table log').locator('li').first()).toContainText('cut Standard 52 at 20');
  await ctx.close();
});

for (const vp of [PHONE, { viewport: { width: 1280, height: 800 } }]) {
  test(`count control is no larger than one input at ${vp.viewport.width}px (3.1)`, async ({ browser }) => {
    const { ctx, page } = await newPlayer(browser, 'Alex', vp);
    await createTable(page, `Count size ${vp.viewport.width}`, { deck: 'builtin-standard-52' });
    await openDraw(page);
    const row = page.locator('.count-field').first();
    const box = (await row.boundingBox())!;
    const container = (await page.getByRole('dialog').boundingBox())!;
    const select = (await page.locator('#dto').boundingBox())!; // a standard full-width input in the same sheet
    expect(box.height).toBeLessThanOrEqual(44.5);
    expect(box.width).toBeLessThanOrEqual(container.width);
    expect(box.width).toBeLessThanOrEqual(select.width + 0.5);
    expect(Math.abs(box.height - select.height)).toBeLessThanOrEqual(1);
    await ctx.close();
  });
}
