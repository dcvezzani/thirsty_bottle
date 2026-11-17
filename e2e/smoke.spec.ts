import { test, expect } from '@playwright/test';

test('two players can open the app in separate browser contexts', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await a.goto('/');
  await b.goto('/');
  await expect(a).toHaveTitle(/Card Table/);
  await expect(b).toHaveTitle(/Card Table/);
});
