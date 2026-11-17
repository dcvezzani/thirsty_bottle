import { test, expect } from '@playwright/test';
import { lowContrast } from './contrast';

test('contrast helper reports white-on-white text, faint placeholders and invisible control boundaries', async ({ page }) => {
  await page.setContent(`
    <body style="background:#0f3d2e;color:#fff;margin:0">
      <div style="color:#fff">readable on felt</div>
      <button id="bad" style="background:#fffdf8;color:inherit;border:1px solid #fffdf8">Add</button>
      <button id="good" style="background:#fffdf8;color:#1d1d1b;border:0">Fine</button>
      <div style="background:#fffdf8;padding:8px">
        <input id="faint" placeholder="hint" style="background:#fffdf8;border:1px solid #f4f0e6">
        <style>#faint::placeholder{color:#eee}</style>
      </div>
    </body>`);
  const issues = await lowContrast(page);
  const bad = issues.find((i) => i.element.startsWith('button#bad') && i.kind === 'text');
  expect(bad, JSON.stringify(issues)).toBeTruthy();
  expect(bad!.ratio).toBeLessThan(1.1);
  expect(issues.some((i) => i.element.startsWith('input#faint') && i.kind === 'placeholder')).toBe(true);
  expect(issues.some((i) => i.element.startsWith('input#faint') && i.kind === 'boundary')).toBe(true);
  expect(issues.some((i) => i.element.startsWith('button#good'))).toBe(false);
  expect(issues.some((i) => i.text === 'readable on felt')).toBe(false);
});
