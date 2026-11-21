import { test, expect, type Page } from '@playwright/test';
import { newPlayer, createTable, PHONE } from './helpers';
import { settle } from './table-helpers';

// zone-count-label 1.1: the count is never cut off; the name shortens instead
async function countOf(page: Page, zone: string) {
  return page.locator(`section.zone[aria-label="${zone}"] .zone-label`).evaluate((label) => {
    const c = label.querySelector('.zone-count') as HTMLElement;
    const n = label.querySelector('.zone-name') as HTMLElement;
    const lr = label.getBoundingClientRect();
    const cr = c.getBoundingClientRect();
    return {
      text: c.textContent?.replace('·', '').trim(),
      clipped: c.scrollWidth > c.clientWidth + 0.5 || cr.right > lr.right + 0.5 || cr.left < lr.left - 0.5,
      nameShortened: n.scrollWidth > n.clientWidth,
    };
  });
}

test('zone labels always show the full count on a phone; long names shorten instead (1.1)', async ({ browser }) => {
  const { ctx, page } = await newPlayer(browser, 'Alex', PHONE);
  await createTable(page, `Counts ${Date.now() % 100000}`, { deck: 'builtin-standard-52' });
  await page.getByRole('button', { name: 'Table settings' }).click();
  for (let i = 1; i <= 7; i++) {
    await page.getByLabel('New zone name').fill(`Tableau ${i}`);
    await page.getByLabel('New zone layout').selectOption('column');
    await page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click();
  }
  await page.keyboard.press('Escape');
  await page.getByTestId('pile-Standard 52').click();
  await page.getByRole('button', { name: 'Draw…' }).click();
  await page.locator('#dcount').fill('12');
  await page.locator('#dto').selectOption({ label: 'Tableau 3' });
  await page.getByRole('button', { name: 'Draw 12' }).click();
  await expect(page.getByTestId('row-Tableau 3').locator('[data-h]')).toHaveCount(12);
  await settle(page);

  // the seven columns share one row
  const tops = await page.locator('section.zone.zone-column').evaluateAll((e) => e.map((x) => Math.round(x.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);

  const pile = await countOf(page, 'Standard 52');
  expect(pile).toMatchObject({ text: '40', clipped: false });
  const t3 = await countOf(page, 'Tableau 3');
  expect(t3).toMatchObject({ text: '12', clipped: false, nameShortened: true });
  for (let i = 1; i <= 7; i++) expect((await countOf(page, `Tableau ${i}`)).clipped).toBe(false);
  // an empty zone's slim bar
  expect(await countOf(page, 'Tableau 1')).toMatchObject({ text: '0', clipped: false });
  // the accessible name is unchanged
  await expect(page.getByRole('button', { name: 'Tableau 3 actions' })).toHaveCount(1);
  await ctx.close();
});
