import type { Page } from '@playwright/test';

export interface ContrastIssue {
  kind: 'text' | 'placeholder' | 'boundary';
  element: string;
  text: string;
  ratio: number;
  required: number;
}

/**
 * Measures WCAG 2.x contrast of visible text, placeholders and interactive-control boundaries on the page
 * (ui-readability spec). Effective background = first ancestor background that is at least 50% opaque.
 * Card elements ([data-h]) and image overlays are excluded: their contrast depends on user artwork.
 */
export async function lowContrast(page: Page, opts: { fallbackBg?: string } = {}): Promise<ContrastIssue[]> {
  return page.evaluate((fallbackBg) => {
    const parse = (c: string) => (c.match(/[\d.]+/g) ?? ['0', '0', '0', '1']).map(Number);
    const lum = (c: string) => {
      const [r, g, b] = parse(c);
      const f = (v: number) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a: string, b: string) => {
      const x = lum(a);
      const y = lum(b);
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    const opaque = (c: string) => {
      const p = parse(c);
      return c !== 'transparent' && (p.length < 4 || p[3] >= 0.5);
    };
    const bgOf = (el: Element | null): string => {
      while (el) {
        const c = getComputedStyle(el).backgroundColor;
        if (opaque(c)) return c;
        el = el.parentElement;
      }
      return fallbackBg;
    };
    const visible = (el: HTMLElement) => {
      if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return false;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.1;
    };
    const excluded = (el: Element) => !!el.closest('[data-h], .gen-back, img');
    const describe = (el: Element) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}`;
    const out: { kind: 'text' | 'placeholder' | 'boundary'; element: string; text: string; ratio: number; required: number }[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      if (excluded(el) || !visible(el)) continue;
      const cs = getComputedStyle(el);
      const isField = ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) && (el as HTMLInputElement).type !== 'checkbox' && (el as HTMLInputElement).type !== 'color';
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
      const bg = bgOf(el);
      if (ownText || (isField && ((el as HTMLInputElement).value || el.tagName === 'SELECT'))) {
        const size = parseFloat(cs.fontSize);
        const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
        const required = large ? 3 : 4.5;
        const r = ratio(cs.color, bg);
        if (r < required) out.push({ kind: 'text', element: describe(el), text: (el.textContent || (el as HTMLInputElement).value || '').trim().slice(0, 30), ratio: +r.toFixed(2), required });
      }
      if (isField && (el as HTMLInputElement).placeholder && !(el as HTMLInputElement).value) {
        const r = ratio(getComputedStyle(el, '::placeholder').color, bg);
        if (r < 3) out.push({ kind: 'placeholder', element: describe(el), text: (el as HTMLInputElement).placeholder, ratio: +r.toFixed(2), required: 3 });
      }
      // Boundary of interactive controls (WCAG 1.4.11): the control must be distinguishable by its
      // background against its surroundings, or by its border.
      if (isField || el.tagName === 'BUTTON') {
        const outer = bgOf(el.parentElement);
        const own = opaque(cs.backgroundColor) ? cs.backgroundColor : outer;
        const byFill = ratio(own, outer);
        const hasBorder = parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none' && opaque(cs.borderTopColor);
        const byBorder = hasBorder ? ratio(cs.borderTopColor, outer) : 0;
        // text-only buttons without fill/border are links: their label contrast is what matters
        const textOnly = !opaque(cs.backgroundColor) && !hasBorder;
        if (!textOnly && Math.max(byFill, byBorder) < 3)
          out.push({ kind: 'boundary', element: describe(el), text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30), ratio: +Math.max(byFill, byBorder).toFixed(2), required: 3 });
      }
    }
    return out;
  }, opts.fallbackBg ?? 'rgb(15, 61, 46)');
}
