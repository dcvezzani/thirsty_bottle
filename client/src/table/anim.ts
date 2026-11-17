import { useLayoutEffect, useRef } from 'react';
import type { AnimView, TableView } from '@vct/shared';
import { useTable } from '../store/table';

const MOVE_MS = 260;

function rectsByHandle(): Map<string, DOMRect> {
  const m = new Map<string, DOMRect>();
  document.querySelectorAll<HTMLElement>('[data-h]').forEach((el) => {
    if (el.closest('.drag-ghost') || el.closest('.sheet') || el.closest('.other-drag')) return;
    m.set(el.dataset.h!, el.getBoundingClientRect());
  });
  return m;
}

function seatColor(view: TableView, actor: string | null) {
  return view.seats.find((s) => s.playerId === actor)?.color ?? '#888';
}
function seatName(view: TableView, actor: string | null) {
  return view.seats.find((s) => s.playerId === actor)?.name ?? '';
}

/** Black or white, whichever reads better on the given player colour. */
export function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const l = 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
  return l > 0.179 ? '#111' : '#fff';
}

function actorLabel(view: TableView, actor: string | null, at: DOMRect) {
  if (!actor || actor === view.me.playerId) return;
  const el = document.createElement('div');
  el.className = 'actor-float';
  el.textContent = seatName(view, actor);
  el.style.setProperty('--seat-color', seatColor(view, actor));
  el.style.color = inkOn(seatColor(view, actor));
  el.style.left = `${at.left + at.width / 2}px`;
  el.style.top = `${at.top}px`;
  document.body.appendChild(el);
  el.animate([{ opacity: 0, transform: 'translate(-50%, 0)' }, { opacity: 1, transform: 'translate(-50%, -14px)' }, { opacity: 0, transform: 'translate(-50%, -28px)' }], { duration: 1100, easing: 'ease-out' }).onfinish = () => el.remove();
}

/** A card back travelling between two rects (used when the destination is a hidden hand). */
function ghost(from: DOMRect, to: DOMRect, color: string, delay: number) {
  const el = document.createElement('div');
  el.className = 'card back anim-ghost';
  el.innerHTML = '<div class="gen-back"></div>';
  el.style.left = `${from.left}px`;
  el.style.top = `${from.top}px`;
  el.style.width = `${from.width}px`;
  el.style.outline = `2px solid ${color}`;
  document.body.appendChild(el);
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  el.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx}px, ${dy}px) scale(0.5)`, opacity: 0.4 }], { duration: 420, delay, easing: 'ease-in-out', fill: 'both' }).onfinish = () => el.remove();
}

/**
 * FLIP animations for card movement, flips, shuffles and deals, with actor labels in player colors.
 * Rects are captured before each store update and replayed after React commits.
 */
export function useFlip(view: TableView) {
  const before = useRef<Map<string, DOMRect>>(new Map());
  const lastAnim = useRef(0);

  // capture positions right before any table state change
  useLayoutEffect(() => {
    const unsub = useTable.subscribe((s, prev) => {
      if (s.view !== prev.view) before.current = rectsByHandle();
    });
    before.current = rectsByHandle();
    return unsub;
  }, []);

  useLayoutEffect(() => {
    const prev = before.current;
    const { anims } = useTable.getState();
    const fresh = anims.id !== lastAnim.current ? anims.list : [];
    lastAnim.current = anims.id;
    const renamed = new Map<string, string>(); // toH → fromH
    for (const a of fresh) if (a.kind === 'move' || a.kind === 'deal') for (const it of a.items) if (it.fromH) renamed.set(it.toH, it.fromH);

    document.querySelectorAll<HTMLElement>('[data-h]').forEach((el) => {
      if (el.closest('.drag-ghost') || el.closest('.sheet') || el.closest('.other-drag')) return;
      const h = el.dataset.h!;
      const old = prev.get(h) ?? prev.get(renamed.get(h) ?? '');
      if (!old) return;
      const now = el.getBoundingClientRect();
      const dx = old.left - now.left;
      const dy = old.top - now.top;
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
      el.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], { duration: MOVE_MS, easing: 'cubic-bezier(.2,.8,.2,1)' });
    });

    for (const a of fresh) runEffect(view, a, prev);
  }, [view]);
}

function runEffect(view: TableView, a: AnimView, prev: Map<string, DOMRect>) {
  const color = seatColor(view, a.actor);
  if (a.kind === 'shuffle') {
    const el = document.querySelector<HTMLElement>(`[data-zone-id="${a.zone}"]`);
    if (el) {
      el.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-4deg) translateX(-4px)' }, { transform: 'rotate(4deg) translateX(4px)' }, { transform: 'rotate(-3deg)' }, { transform: 'rotate(0)' }], { duration: 520 });
      actorLabel(view, a.actor, el.getBoundingClientRect());
    }
    return;
  }
  if (a.kind === 'flip') {
    for (const h of a.handles) document.querySelector<HTMLElement>(`[data-h="${h}"]`)?.animate([{ transform: 'rotateY(0)' }, { transform: 'rotateY(90deg)' }, { transform: 'rotateY(0)' }], { duration: 320, composite: 'add' } as any);
    const first = document.querySelector<HTMLElement>(`[data-h="${a.handles[0]}"]`);
    if (first) actorLabel(view, a.actor, first.getBoundingClientRect());
    return;
  }
  // move / deal: cards going to a hidden hand (rendered as a seat marker) travel as ghosts
  let labelled = false;
  a.items.forEach((it, i) => {
    const dest = view.zones.find((z) => z.id === it.to);
    const visibleEl = document.querySelector<HTMLElement>(`[data-h="${it.toH}"]`);
    if (!labelled && visibleEl && a.actor !== view.me.playerId) {
      actorLabel(view, a.actor, visibleEl.getBoundingClientRect());
      labelled = true;
    }
    if (visibleEl) return;
    if (dest?.kind !== 'hand') return;
    const marker = document.querySelector<HTMLElement>(`[data-seat-zone="${dest.id}"]`);
    const src = prev.get(it.fromH ?? '') ?? document.querySelector<HTMLElement>(`[data-zone-id="${it.from}"]`)?.getBoundingClientRect();
    if (!marker || !src) return;
    const to = marker.getBoundingClientRect();
    ghost(src, to, color, a.kind === 'deal' ? i * 45 : 0);
    if (!labelled) {
      actorLabel(view, a.actor, to);
      labelled = true;
    }
  });
}
