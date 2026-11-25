import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { TableDeckView, ZoneView } from '@vct/shared';
import { CardFace } from '../components/Card';
import { ZoneGesture, applyPaint, paintMode, type Sample } from './gestures';
import { cardPos, fanLayout, hitIndex, hitIndexXY, insertionIndex, magnify } from './layout';
import { useUI } from './ui';
import { dropRegistry, endDrag, moveDrag, startDrag, cancelDrag } from './drag';
import { isBoardPanning, onCancelCardGestures } from './pan';
import { quickFlip } from './flip';
import { pickLoupe } from './loupe';
import { registerStrip, StripRun } from './scrubStrip';

function vibrate(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
}

/** scrub-loupe: show the card under x again after the strip handed the scrub back. */
function showOwn(h: { indexAt(x: number): number }, zoneId: string, x: number, cards: { h: string }[]) {
  const hh = cards[h.indexAt(x)]?.h;
  if (hh) useUI.setState({ preview: { h: hh, zone: zoneId } });
}

/** scrub-loupe: choose the loupe's side from the pressed zone and the board, once, when a touch scrub starts. */
export function placeLoupe(el: HTMLElement | null, pointerType: string) {
  if (!el || pointerType === 'mouse') return;
  const board = el.closest('.board') ?? document.querySelector('.board');
  const b = board?.getBoundingClientRect();
  const zr = (el.closest('.zone') ?? el).getBoundingClientRect();
  if (!b) return;
  const p = pickLoupe({ top: zr.top, bottom: zr.bottom }, { top: b.top, bottom: b.bottom });
  useUI.setState({ loupe: { ...p, details: false, row: null } });
}

/**
 * A scrubbable row of cards: the player's fanned hand, a shared spread, or a fanned-out pile.
 * Gestures: tap = toggle selection · sideways slide = scrub preview / paint selection ·
 * pull up/out = drag (the selection if the card is selected) · still hold = card info.
 */
export function CardRow({
  zone,
  decks,
  arc = false,
  interactive = true,
  draggable = true,
  height,
  dropId,
  onInfo,
  testId,
  emptyText,
  onScrubStart,
  strip = false,
}: {
  zone: ZoneView;
  decks: TableDeckView[];
  arc?: boolean;
  interactive?: boolean;
  draggable?: boolean;
  height?: number;
  /** Zone id used as drop target (omit to disable dropping). */
  dropId?: string;
  onInfo: (h: string) => void;
  /** Overrides the row's test id (the viewed player's hand while viewing their table). */
  testId?: string;
  /** Message for an empty row; default "Your hand is empty" for hands, "Empty" otherwise. */
  emptyText?: string;
  /** shared-hand-dock: a sideways slide started on this row (the dock focuses a narrow column). */
  onScrubStart?: () => void;
  /** scrub-loupe: a board zone, part of the strip a scrub can slide along. */
  strip?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [cardW, setCardW] = useState(64);
  const selZone = useUI((s) => s.selZone);
  const selected = useUI((s) => s.selected);
  const preview = useUI((s) => s.preview);
  const drag = useUI((s) => s.drag);
  const zoom = useUI((s) => s.zoom);
  const cards = zone.cards;
  const dragSet = useMemo(() => new Set(drag?.handles ?? []), [drag]);
  // hide dragged cards from their origin; open an insertion gap where they would land
  const shown = useMemo(() => (drag ? cards.filter((c) => !dragSet.has(c.h)) : cards), [cards, drag, dragSet]);
  const gapAt = drag && drag.over?.kind === 'zone' && drag.over.zone === zone.id && drag.over.index !== undefined ? drag.over.index - cards.slice(0, drag.over.index).filter((c) => dragSet.has(c.h)).length : null;
  const maxSpacing = arc ? undefined : cardW * 1.06;
  const L = useMemo(() => fanLayout(shown.length, width, cardW, { arc, gapAt, maxSpacing }), [shown.length, width, cardW, arc, gapAt, maxSpacing]);
  const Lfull = useMemo(() => fanLayout(cards.length, width, cardW, { arc, maxSpacing }), [cards.length, width, cardW, arc, maxSpacing]);
  const focus = preview && preview.zone === zone.id ? shown.findIndex((c) => c.h === preview.h) : -1;
  const selSet = new Set(selZone === zone.id ? selected : []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      setWidth(el.clientWidth);
      const cs = getComputedStyle(el);
      const raw = cs.getPropertyValue('--card-w').trim();
      // --card-w is either a plain px value (e.g. in sheets) or calc(var(--base-card-w) * zoom) on the table
      const cw = /^[\d.]+px$/.test(raw) ? parseFloat(raw) : (parseFloat(cs.getPropertyValue('--base-card-w')) || 64) * zoom;
      setCardW(cw);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [zoom]);

  // drop target: insertion index from layout math
  useEffect(() => {
    if (!dropId) return;
    dropRegistry.set(dropId, (x) => {
      const r = ref.current!.getBoundingClientRect();
      return { index: insertionIndex(Lfull, x - r.left) };
    });
    return () => {
      dropRegistry.delete(dropId);
    };
  }, [dropId, Lfull]);

  // gesture recognizer (kept across renders; reads fresh state through refs)
  const live = useRef({ cards, zone, onInfo, draggable, interactive, onScrubStart, strip });
  live.current = { cards, zone, onInfo, draggable, interactive, onScrubStart, strip };
  // the row can resize mid-gesture (hand dock columns): the gesture must survive it, so it reads width through a ref
  const widthRef = useRef(width);
  widthRef.current = width;
  const pendingScrub = useRef<{ i: number; timer: ReturnType<typeof setTimeout> | null }>({ i: -1, timer: null });
  const paint = useRef<'preview' | 'select' | 'deselect'>('preview');
  const lastScrub = useRef<string | null>(null);
  /** The pointer type of the current press: the loupe is for touch and pen; the mouse keeps the hover preview. */
  const pointer = useRef<string>('touch');
  const run = useRef<StripRun | null>(null);
  const gesture = useMemo(() => {
    const hit = (x: number, y: number) =>
      hitIndexXY(fanLayout(live.current.cards.length, ref.current?.clientWidth ?? widthRef.current, cardW, { arc, maxSpacing: arc ? undefined : cardW * 1.06 }), x, y, arc ? cardW * 0.3 : 0);
    const h = (i: number) => live.current.cards[i]?.h;
    const setPreview = (i: number) => {
      const hh = h(i);
      if (!hh) return;
      if (hh !== lastScrub.current) vibrate(5);
      lastScrub.current = hh;
      useUI.setState({ preview: { h: hh, zone: live.current.zone.id } });
      if (paint.current !== 'preview') {
        const st = useUI.getState();
        const base = new Set(st.selZone === live.current.zone.id ? st.selected : []);
        st.select(live.current.zone.id, [...applyPaint(base, paint.current, hh)]);
      }
    };
    let origin = { x: 0, y: 0 };
    return {
      origin: (o: { x: number; y: number }) => (origin = o),
      g: new ZoneGesture({
        hit: (x, y) => hit(x, y),
        onTap: (i) => {
          if (i === null || !live.current.interactive) return;
          useUI.getState().toggle(live.current.zone.id, h(i)!);
        },
        onDoubleTap: (i) => {
          const hh = h(i);
          if (!hh || !live.current.interactive) return;
          useUI.getState().toggle(live.current.zone.id, hh); // undo the first tap's toggle
          void quickFlip(live.current.zone.id, hh);
        },
        onLongPress: (i) => {
          vibrate(15);
          live.current.onInfo(h(i)!);
        },
        onScrubStart: (i) => {
          live.current.onScrubStart?.();
          placeLoupe(ref.current, pointer.current);
          if (live.current.strip && pointer.current !== 'mouse') {
            run.current = new StripRun(live.current.zone.id, (entry, name) => {
              vibrate(12);
              const l = useUI.getState().loupe;
              if (l) useUI.setState({ loupe: { ...l, row: entry.rows > 1 ? `Row ${entry.row} of ${entry.rows} · ${name}` : name, details: false } });
            });
            const first = run.current.label();
            const l = useUI.getState().loupe;
            if (first && l) useUI.setState({ loupe: { ...l, row: first } });
          }
          const st = useUI.getState();
          const sel = new Set(st.selZone === live.current.zone.id ? st.selected : []);
          paint.current = live.current.interactive ? paintMode(sel, h(i)!) : 'preview';
          lastScrub.current = null;
          setPreview(i);
        },
        onDwell: () => {
          if (useUI.getState().loupe) useUI.setState({ loupe: { ...useUI.getState().loupe!, details: true } });
          // a pause also widens a board zone and pins it open, so its cards can be tapped or painted after release
          if (live.current.strip && pointer.current !== 'mouse') useUI.setState({ openZone: { id: run.current?.away ? run.current.cur : live.current.zone.id, pinned: true } });
        },
        onScrub: (i) => {
          if (run.current?.away) return; // the strip is showing a card in another zone
          if (useUI.getState().loupe?.details) useUI.setState({ loupe: { ...useUI.getState().loupe!, details: false } });
          // shared-hand-dock: while the columns resize, hold the latest index and apply it when they settle
          const wait = useUI.getState().dockSettleUntil - performance.now();
          if (wait > 0) {
            pendingScrub.current.i = i;
            if (!pendingScrub.current.timer)
              pendingScrub.current.timer = setTimeout(() => {
                pendingScrub.current.timer = null;
                if (pendingScrub.current.i >= 0) setPreview(pendingScrub.current.i);
              }, wait);
            return;
          }
          setPreview(i);
        },
        onScrubEnd: () => {
          lastScrub.current = null;
          if (pendingScrub.current.timer) clearTimeout(pendingScrub.current.timer);
          pendingScrub.current = { i: -1, timer: null };
          run.current = null;
          useUI.setState({ preview: null, loupe: null });
        },
        onDragStart: (i, s) => {
          if (!live.current.draggable || !live.current.interactive || run.current?.away) return;
          const st = useUI.getState();
          const hh = h(i)!;
          const zid = live.current.zone.id;
          const handles =
            st.selZone === zid && st.selected.includes(hh)
              ? live.current.cards.filter((c) => st.selected.includes(c.h)).map((c) => c.h)
              : [hh];
          startDrag(handles, zid, s.x + origin.x, s.y + origin.y);
        },
        onDragMove: (s: Sample) => moveDrag(s.x + origin.x, s.y + origin.y),
        onDragEnd: (s: Sample) => endDrag(s.x + origin.x, s.y + origin.y),
        onCancel: () => cancelDrag(),
      }),
    };
  }, [cardW, arc]);

  // scrub-loupe: this row can be reached by a scrub that started in a neighbouring zone
  const handle = useRef<{ indexAt(x: number): number } | null>(null);
  useEffect(() => {
    if (!strip) return;
    const layout = () => fanLayout(live.current.cards.length, ref.current?.clientWidth ?? widthRef.current, cardW, { arc, maxSpacing: arc ? undefined : cardW * 1.06 });
    const h = {
      el: ref.current!,
      name: zone.name,
      extent: () => {
        const l = layout();
        return { left: l.left, right: l.left + l.spacing * Math.max(0, l.n - 1) + l.cardW };
      },
      indexAt: (x: number) => {
        const l = layout();
        return hitIndex(l, x) ?? (x < l.left ? 0 : Math.max(0, l.n - 1));
      },
      show: (i: number) => {
        const hh = live.current.cards[i]?.h;
        if (!hh) return;
        if (hh !== lastScrub.current) vibrate(5);
        lastScrub.current = hh;
        const l = useUI.getState().loupe;
        useUI.setState({ preview: { h: hh, zone: live.current.zone.id }, ...(l?.details ? { loupe: { ...l, details: false } } : {}) });
      },
    };
    handle.current = h;
    const off = registerStrip(zone.id, h);
    return () => {
      off();
      handle.current = null;
    };
  }, [strip, zone.id, zone.name, cardW, arc]);

  useEffect(() => {
    const t = setInterval(() => gesture.g.tick(performance.now()), 50);
    // a second finger on the board means "scroll": drop whatever this finger started (table-scrolling)
    const off = onCancelCardGestures(() => gesture.g.cancel());
    return () => {
      clearInterval(t);
      off();
    };
  }, [gesture]);

  const local = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    gesture.origin({ x: r.left, y: r.top });
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2 || isBoardPanning()) return;
    if (e.pointerType === 'mouse' && e.shiftKey) {
      // desktop range select
      const s = local(e);
      const i = hitIndexXY(Lfull, s.x, s.y, arc ? cardW * 0.3 : 0);
      if (i === null) return;
      const st = useUI.getState();
      const sel = st.selZone === zone.id ? st.selected : [];
      const anchor = cards.findIndex((c) => c.h === sel[sel.length - 1]);
      const [a, b] = anchor < 0 ? [i, i] : [Math.min(anchor, i), Math.max(anchor, i)];
      st.select(zone.id, [...new Set([...sel, ...cards.slice(a, b + 1).map((c) => c.h)])]);
      return;
    }
    try {
      ref.current!.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    pointer.current = e.pointerType;
    gesture.g.down(local(e));
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (gesture.g.state === 'idle') {
      // desktop hover preview
      if (e.pointerType === 'mouse' && e.buttons === 0 && !drag) {
        const pt = local(e);
        const i = hitIndexXY(Lfull, pt.x, pt.y, arc ? cardW * 0.3 : 0);
        const hh = i === null ? null : cards[i]?.h;
        const cur = useUI.getState().preview;
        if (hh && (cur?.h !== hh || cur.zone !== zone.id)) useUI.setState({ preview: { h: hh, zone: zone.id } });
        else if (!hh && cur?.zone === zone.id) useUI.setState({ preview: null });
      }
      return;
    }
    gesture.g.move(local(e));
    if (run.current && gesture.g.state === 'scrub') {
      const was = run.current.away;
      const away = run.current.update(e.clientX);
      if (was && !away && handle.current) {
        // back on the zone where the scrub began: its own gesture takes over again
        const r = ref.current!.getBoundingClientRect();
        showOwn(handle.current, live.current.zone.id, e.clientX - r.left, live.current.cards);
      }
    }
  };
  const onPointerUp = (e: React.PointerEvent) => gesture.g.up(local(e));
  const onPointerCancel = () => gesture.g.cancel();
  const onPointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && gesture.g.state === 'idle' && useUI.getState().preview?.zone === zone.id) useUI.setState({ preview: null });
  };
  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const r = ref.current!.getBoundingClientRect();
    const i = hitIndexXY(Lfull, e.clientX - r.left, e.clientY - r.top, arc ? cardW * 0.3 : 0);
    if (i !== null) onInfo(cards[i].h);
  };

  const rowH = height ?? cardW * 1.4 + (arc ? cardW * 0.35 : 0) + 8;
  return (
    <div
      ref={ref}
      className={`card-row ${arc ? 'arc' : ''}`}
      style={{ height: rowH, ['--cw' as any]: `${cardW}px` }}
      data-zone-id={zone.id}
      {...(strip ? { 'data-strip-zone': '1', 'data-count': cards.length } : {})}
      data-testid={testId ?? `row-${zone.kind === 'hand' ? 'hand' : zone.name}`}
      {...(dropId ? { 'data-drop-zone': dropId } : {})}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerLeave}
      onContextMenu={onContextMenu}
    >
      {shown.length === 0 && !drag && <div className="row-empty">{emptyText ?? (zone.kind === 'hand' ? 'Your hand is empty' : 'Empty')}</div>}
      {shown.map((c, i) => {
        const p = cardPos(L, i, gapAt);
        const m = magnify(L, i, focus >= 0 ? focus : null);
        const sel = selSet.has(c.h);
        const lift = sel ? -cardW * 0.22 : 0;
        return (
          <CardFace
            key={c.h}
            card={c}
            decks={decks}
            className={`in-row ${sel ? 'selected' : ''} ${m.scale > 1 ? 'focused' : ''}`}
            style={{
              ['--card-w' as any]: `${cardW}px`,
              transform: `translate(${p.x + m.dx}px, ${p.y + m.dy + lift}px) rotate(${m.scale > 1 ? 0 : p.rot}deg) scale(${m.scale})`,
              zIndex: m.z || i + 1,
            }}
          />
        );
      })}
      {interactive && selSet.size > 0 && (
        <span className="sel-count" data-testid="sel-count">
          {selSet.size}
        </span>
      )}
    </div>
  );
}
