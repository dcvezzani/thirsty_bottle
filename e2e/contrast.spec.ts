import { test, expect, devices, type Page } from '@playwright/test';
import { onboard, createTable, draw, joinTable } from './helpers';
import { stripCenters } from './table-helpers';
import sharp from 'sharp';
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
      // image-library: the Images page with an imported image, its details sheet
      await page.getByRole('button', { name: 'Images' }).click();
      const art = await sharp({ create: { width: 250, height: 350, channels: 3, background: '#336699' } }).png().toBuffer();
      await page.getByLabel('Import images').setInputFiles([
        { name: 'contrast-art.png', mimeType: 'image/png', buffer: art },
        { name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('nope') },
      ]);
      await expect(page.getByText('Imported 1 image.')).toBeVisible();
      await expectReadable(page, 'images page');
      await page.getByRole('list', { name: 'Images' }).getByRole('button', { name: 'contrast-art' }).click();
      await expectReadable(page, 'image details');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Back to decks' }).click();
      await page.getByLabel('New deck name').fill('Contrast deck');
      await page.getByRole('button', { name: 'Create' }).click();
      await page.getByRole('button', { name: '+ Add card' }).click();
      await page.getByRole('button', { name: '+ Property' }).click();
      await expectReadable(page, 'card form');
      // card-form-remember: pinned state and the same-name hint
      await page.getByLabel('Pin name').click();
      await page.getByLabel('Pin copies').click();
      await page.locator('#cname').fill('Pinned');
      await page.getByRole('button', { name: 'Save & add another' }).click();
      await expect(page.getByText('Same name as the last card')).toBeVisible();
      await expectReadable(page, 'card form pinned');
      await page.getByRole('button', { name: 'Choose from images…' }).first().click();
      await expect(page.getByRole('dialog', { name: 'Choose from images' }).getByRole('button', { name: 'Use contrast-art' })).toBeVisible();
      await expectReadable(page, 'image picker');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: 'Choose from images' })).toHaveCount(0);
      await expect(page.getByRole('dialog', { name: 'New card' })).toBeVisible(); // Escape closes only the top sheet
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Images', exact: true }).click();
      await page.getByRole('region', { name: 'Deck images' }).getByRole('button', { name: 'All' }).click();
      await expectReadable(page, 'deck images');

      // table: zone sheet, draw sheet, counters, drawer, seat and card info
      await page.goto('/');
      await createTable(page, `Contrast ${scheme} ${size.name}`, { deck: 'builtin-standard-52' });
      await expectReadable(page, 'table');
      await page.evaluate(() => (window as any).__vctShowUpdate());
      await expect(page.getByRole('status').filter({ hasText: 'A new version is available' })).toBeVisible();
      await expectReadable(page, 'update notice');
      await page.getByTestId('pile-Standard 52').click();
      await expect(page.getByRole('dialog').getByRole('button', { name: 'All face down' })).toBeVisible(); // the pile's sheet opens after a short pause
      await expectReadable(page, 'zone sheet');
      await page.getByRole('button', { name: 'Draw…' }).click();
      await expectReadable(page, 'draw sheet');
      await page.keyboard.press('Escape');
      await draw(page, 'Standard 52', 3);
      // selection toolbar (clear, Flip, send again, Actions…)
      await page.getByTestId('row-hand').locator('[data-h]').first().click({ position: { x: 8, y: 30 } });
      await expect(page.locator('.selection-bar')).toBeVisible();
      await expect(page.locator('.selection-bar').getByRole('button', { name: 'Flip', exact: true })).toBeVisible();
      await expectReadable(page, 'selection bar');
      // stable-selection-bar: the Actions sheet with Select all / Clear / Face down, then the toolbar's face down tag
      await page.getByRole('button', { name: 'Actions…' }).click();
      await expectReadable(page, 'actions sheet with selection controls');
      await page.getByRole('dialog').getByLabel(/Face down/).check();
      await page.keyboard.press('Escape');
      await expect(page.locator('.face-down-tag')).toBeVisible();
      await expectReadable(page, 'selection bar with face down tag');
      await page.getByRole('button', { name: 'Actions…' }).click();
      await page.getByRole('dialog').getByLabel(/Face down/).uncheck();
      await page.keyboard.press('Escape');
      await page.locator('.selection-bar').getByRole('button', { name: 'Clear selection' }).click();
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
      // zone-arrangement: slim empty bars, a column being scrubbed, and arrange mode
      await page.getByRole('button', { name: 'Table settings' }).click();
      for (const [n, layout] of [['Empty bar', 'spread'], ['Col', 'column']]) {
        await page.getByLabel('New zone name').fill(n);
        await page.getByLabel('New zone layout').selectOption(layout);
        await page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click();
      }
      await page.keyboard.press('Escape');
      await expectReadable(page, 'slim empty zone');
      await page.getByTestId('pile-Standard 52').click();
      await page.getByRole('button', { name: 'Draw…' }).click();
      await page.locator('#dcount').fill('4');
      await page.locator('#dto').selectOption({ label: 'Col' });
      await page.getByRole('button', { name: 'Draw 4' }).click();
      await expect(page.getByTestId('row-Col').locator('[data-h]')).toHaveCount(4);
      await page.getByRole('button', { name: 'Col actions' }).click();
      await page.getByRole('button', { name: 'Flip all' }).click();
      await page.keyboard.press('Escape');
      await page.getByTestId('row-Col').locator('[data-h]').nth(1).hover({ position: { x: 10, y: 6 } });
      await expectReadable(page, 'column opened');
      await page.mouse.move(1, 1);
      await page.getByRole('button', { name: 'Table settings' }).click();
      await page.getByRole('button', { name: 'Arrange zones' }).click();
      await expect(page.getByRole('region', { name: 'Arranging zones' })).toBeVisible();
      await expectReadable(page, 'arrange mode');
      await page.getByRole('button', { name: 'Done' }).click();
      await page.getByTestId('row-hand').click({ button: 'right', position: { x: 60, y: 60 } });
      await expectReadable(page, 'card info sheet');
      await page.keyboard.press('Escape');

      // per-player-zones: my own copy on the board, another player's counts and seat sheet
      await page.getByRole('button', { name: 'Table settings' }).click();
      await page.getByLabel('New zone name').fill('Mine');
      await page.getByLabel('One per player (each player gets their own copy)').check();
      await expectReadable(page, 'add per-player zone');
      await page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click();
      await page.keyboard.press('Escape');
      await expect(page.locator('.zone-name', { hasText: /^Mine$/ })).toBeVisible();
      await expectReadable(page, 'per-player zone');
      const samCtx = await browser.newContext({ ...size.use, colorScheme: scheme });
      const samPage = await samCtx.newPage();
      await onboard(samPage, 'Sam');
      await joinTable(samPage, `Contrast ${scheme} ${size.name}`);
      await expect(page.getByTestId('seat-Sam')).toBeVisible();
      await expectReadable(page, 'seat bar');
      await page.getByTestId('seat-Sam').click();
      await expect(page.getByRole('region', { name: "Sam's Mine" })).toBeVisible();
      await expectReadable(page, 'seat sheet with per-player zone');
      // player-views: the view banner, the eye pill and a viewing seat chip
      await page.getByRole('button', { name: 'View table' }).click();
      await expect(page.getByRole('region', { name: 'Viewing another table' })).toBeVisible();
      await expectReadable(page, 'viewing another table');
      // shared-hand-dock: the dock with an empty, a none-shown and a shown-card viewed hand, and the badges
      await expect(page.getByLabel("Sam's hand", { exact: true })).toContainText("Sam's hand is empty");
      await expectReadable(page, 'hand dock, empty viewed hand');
      await draw(samPage, 'Standard 52', 3);
      await expect(page.getByLabel("Sam's hand", { exact: true })).toContainText('none shown');
      await expectReadable(page, 'hand dock, none shown');
      const samCards = await stripCenters(samPage, 'row-hand');
      await samPage.mouse.click(samCards[0].x, samCards[0].y);
      await samPage.getByRole('button', { name: 'Actions…' }).click();
      await samPage.getByRole('button', { name: 'Show to…' }).click();
      await samPage.getByRole('dialog').getByRole('button', { name: 'Alex' }).click();
      await expect(page.getByLabel("Sam's hand", { exact: true })).toContainText('1 shown');
      await expectReadable(page, 'hand dock, a shown card');
      await expect(samPage.locator('.viewing-pill')).toContainText('Alex');
      await expect(samPage.getByTestId('seat-Alex')).toHaveAttribute('aria-label', /viewing you/);
      await expectReadable(samPage, 'eye pill');
      await samPage.getByTestId('seat-Alex').click();
      await expect(samPage.getByTestId('seat-status')).toContainText('viewing you');
      await expectReadable(samPage, 'seat sheet status line');
      await samPage.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Mine', exact: true }).click();
      await samCtx.close();
      // compact-seat-chips: a disconnected player's chip is dimmed, still readable
      await expect(page.getByTestId('seat-Sam')).toHaveAttribute('aria-label', /disconnected/, { timeout: 15_000 });
      await expectReadable(page, 'away seat chip');

      // table-setups: the Apply setup sheet, the Setups page and the setup editor
      await page.evaluate(async () => {
        const h = { authorization: `Bearer ${sessionStorage.getItem('vct.token')}`, 'content-type': 'application/json' };
        const s = await (await fetch('/api/setups', { method: 'POST', headers: h, body: JSON.stringify({ name: 'Contrast setup' }) })).json();
        const content = {
          name: 'Contrast setup',
          players: { min: 1, max: 4 },
          slots: [{ id: 's1', label: 'Deck', defaultDeckId: 'builtin-standard-52' }],
          homes: { s1: 'stock' },
          zones: [{ key: 'stock', name: 'Stock', layout: 'pile' }, { key: 'row', name: 'Row', layout: 'column', down: 2, up: 1 }],
          hands: { count: 5 },
          counters: [{ label: '{name} score', value: 0, perSeat: true }],
        };
        await fetch(`/api/setups/${s.id}/save`, { method: 'POST', headers: h, body: JSON.stringify({ content }) });
      });
      await page.getByRole('button', { name: 'Table settings' }).click();
      await page.getByRole('button', { name: 'Apply setup…' }).click();
      await expect(page.getByRole('dialog').getByText('Contrast setup')).toBeVisible();
      await expectReadable(page, 'apply setup sheet');
      await page.getByRole('dialog').getByLabel('Your setups').getByRole('button', { name: 'Choose' }).click();
      await expectReadable(page, 'apply setup decks');
      await page.keyboard.press('Escape');
      await page.goto('/setups');
      await expect(page.getByLabel('My setups').getByTestId('setup-row')).toHaveCount(1);
      await expectReadable(page, 'setups page');
      await page.getByLabel('My setups').getByTestId('setup-row').click();
      await expect(page.getByLabel('Zone 2 face down')).toHaveValue('2');
      await expectReadable(page, 'setup editor');
      // setup-sharing: the visibility control, the gallery and a read-only (built-in) setup
      await page.locator('#svisibility').selectOption('link');
      await expect(page.getByLabel('Setup share link')).toBeVisible();
      await expectReadable(page, 'setup visibility');
      await page.goto('/setups');
      await page.getByRole('tab', { name: 'Gallery' }).click();
      await expectReadable(page, 'setup gallery');
      await page.goto('/setups/builtin-setup-klondike');
      await expect(page.getByTestId('setup-owner')).toContainText('Built-in');
      await expectReadable(page, 'read-only setup');
      await ctx.close();
    });
  }
}
