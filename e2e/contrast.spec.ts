import { test, expect, devices, type Page } from '@playwright/test';
import { onboard, createTable, draw } from './helpers';
import { lowContrast } from './contrast';

const SIZES = [
  { name: 'phone', use: { ...devices['iPhone 13'] } },
  { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
];

async function expectReadable(page: Page, state: string) {
  const issues = await lowContrast(page);
  expect(issues, `${state}: ${issues.map((i) => `${i.kind} ${i.element} "${i.text}" ${i.ratio} < ${i.required}`).join('\n')}`).toEqual([]);
}

for (const scheme of ['light', 'dark'] as const) {
  for (const size of SIZES) {
    test(`readable contrast: ${scheme} ${size.name}`, async ({ browser }) => {
      test.setTimeout(90_000);
      const ctx = await browser.newContext({ ...size.use, colorScheme: scheme });
      const page = await ctx.newPage();
      await onboard(page, 'Alex');
      // lobby tabs and create sheet
      await expectReadable(page, 'lobby tables');
      for (const tab of [/Players/, /Chat/]) {
        await page.getByRole('tab', { name: tab }).click();
        await expectReadable(page, `lobby ${tab}`);
      }
      await page.getByRole('tab', { name: 'Tables' }).click();
      await page.getByRole('button', { name: '+ New table' }).click();
      await expectReadable(page, 'create-table sheet');
      await page.keyboard.press('Escape');

      // deck editor with the card form open
      await page.getByRole('button', { name: 'Decks' }).click();
      await expectReadable(page, 'decks library');
      await page.getByLabel('New deck name').fill('Contrast deck');
      await page.getByRole('button', { name: 'Create' }).click();
      await page.getByRole('button', { name: '+ Add card' }).click();
      await page.getByRole('button', { name: '+ Property' }).click();
      await expectReadable(page, 'card form');
      await page.keyboard.press('Escape');

      // table: zone sheet, draw sheet, counters, drawer, seat and card info
      await page.goto('/');
      await createTable(page, `Contrast ${scheme} ${size.name}`, { deck: 'builtin-standard-52' });
      await expectReadable(page, 'table');
      await page.getByTestId('pile-Standard 52').click();
      await expectReadable(page, 'zone sheet');
      await page.getByRole('button', { name: 'Draw…' }).click();
      await expectReadable(page, 'draw sheet');
      await page.keyboard.press('Escape');
      await draw(page, 'Standard 52', 3);
      await page.getByRole('button', { name: '+ Counter' }).click();
      await expectReadable(page, 'counters empty');
      await page.getByLabel('New counter').fill('Matt');
      await expectReadable(page, 'counters typed');
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      await page.getByRole('button', { name: 'Info', exact: true }).click();
      await expectReadable(page, 'info drawer');
      await page.getByRole('button', { name: 'Info', exact: true }).click();
      await page.getByRole('button', { name: 'Table settings' }).click();
      await expectReadable(page, 'settings sheet');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Table actions' }).click();
      await expectReadable(page, 'table zone sheet');
      await page.keyboard.press('Escape');
      await page.getByTestId('row-hand').click({ button: 'right', position: { x: 60, y: 60 } });
      await expectReadable(page, 'card info sheet');
      await ctx.close();
    });
  }
}
