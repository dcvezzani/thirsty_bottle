import { expect, type Page } from '@playwright/test';

/** Creates and saves a deck through the API from inside the page (uses the tab's token). */
export async function makeDeck(page: Page, name: string, cards: { name: string; count: number; metadata?: Record<string, unknown> }[]) {
  return page.evaluate(
    async ({ name, cards }) => {
      const h = { authorization: `Bearer ${sessionStorage.getItem('vct.token')}`, 'content-type': 'application/json' };
      const d = await (await fetch('/api/decks', { method: 'POST', headers: h, body: JSON.stringify({ name }) })).json();
      await fetch(`/api/decks/${d.id}/draft/ops`, { method: 'POST', headers: h, body: JSON.stringify({ ops: cards.map((c) => ({ op: 'add', card: { metadata: {}, ...c } })) }) });
      await fetch(`/api/decks/${d.id}/save`, { method: 'POST', headers: h, body: '{}' });
      return d.id as string;
    },
    { name, cards },
  );
}

export type Pt = { x: number; y: number };

/** Synthetic touch gestures through CDP (Playwright has no touch-move API). */
export async function touchPath(page: Page, points: Pt[], opts: { stepMs?: number; holdMs?: number; release?: boolean } = {}) {
  const cdp = await page.context().newCDPSession(page);
  const step = opts.stepMs ?? 20;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: points[0].x, y: points[0].y }] });
  if (opts.holdMs) await page.waitForTimeout(opts.holdMs);
  for (const p of points.slice(1)) {
    await page.waitForTimeout(step);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: p.y }] });
  }
  if (opts.release !== false) {
    await page.waitForTimeout(step);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  return cdp;
}

/** Interpolated points between a and b. */
export function line(a: Pt, b: Pt, n = 8): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n }));
}

/** For each card in a row, a point where that card is visibly on top (what a finger would tap). */
export async function settle(page: Page) {
  await page.waitForFunction(() => document.getAnimations().filter((a) => a.playState === 'running').length === 0);
  await page.waitForTimeout(180); // CSS transitions on transform
}

export async function stripCenters(page: Page, testId: string): Promise<Pt[]> {
  await settle(page);
  return page.getByTestId(testId).evaluate((row) => {
    const cards = [...row.querySelectorAll<HTMLElement>('[data-h]')];
    return cards.map((c) => {
      const r = c.getBoundingClientRect();
      const hits: Pt[] = [];
      for (let fy = 0.85; fy >= 0.35; fy -= 0.1)
        for (let fx = 0.05; fx <= 0.95; fx += 0.05) {
          const x = r.left + r.width * fx;
          const y = r.top + r.height * fy;
          const top = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-h]');
          if (top === c) hits.push({ x, y });
        }
      if (!hits.length) return { x: -1, y: -1 };
      // middle of the visible region
      return hits[Math.floor(hits.length / 2)];
    });
  });
}

export async function handles(page: Page, testId: string): Promise<string[]> {
  return page.getByTestId(testId).locator('[data-h]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.h!));
}

export async function lastLog(page: Page) {
  await page.getByRole('button', { name: 'Log', exact: true }).click();
  const t = await page.getByLabel('Table log').locator('li').first().innerText();
  await page.getByRole('button', { name: 'Log', exact: true }).click();
  return t;
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator('.toast').filter({ hasText: text })).toBeVisible();
}
