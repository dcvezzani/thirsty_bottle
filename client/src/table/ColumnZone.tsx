import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { TableDeckView, ZoneView } from '@vct/shared';
import { CardFace } from '../components/Card';
import { ZoneGesture, applyPaint, paintMode, type Sample } from './gestures';
import { columnHit, columnLayout, columnMagnify, type ColumnLayout } from './column';
import { useUI } from './ui';
import { finishScrub, placeLoupe, tapEndsViewing } from './CardRow';
import { enterRegistry } from './scrubStrip';
import { zonePad } from './rotation';
import { cancelDrag, dropRegistry, endDrag, moveDrag, startDrag } from './drag';
import { isBoardPanning, onCancelCardGestures } from './pan';
import { quickFlip } from './flip';

/**
 * The card at y in the layout that is drawn: the compressed column with the previewed card (if it is in this column) opened,
 * so the card found under the finger is the card the loupe and the column show (column-scrub-hit).
 */
function drawnHit(l: ColumnLayout, cards: { h: string }[], zoneId: string, y: number): number | null {
  const p = useUI.getState().preview;
  const f = p && p.zone === zoneId ? cards.findIndex((c) => c.h === p.h) : -1;
  return columnHit(columnMagnify(l, f >= 0 ? f : null), y);
}

/**
 * A column zone (zone-arrangement): cards cascade downward and compress. Gestures mirror a row with
 * the axes swapped: slide along the column = scrub (cards near the finger open up) · move sideways
 * out = pick up that card and everything below it (or the selection) · tap = select · hold = info.
 * Dropped cards always go on the end.
 */
export function ColumnZone({ zone, decks, interactive, onInfo }: { zone: ZoneView; decks: TableDeckView[]; interactive: boolean; onInfo: (h: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [cardW, setCardW] = useState(64);
  const selZone = useUI((s) => s.selZone);
  const selected = useUI((s) => s.selected);
  const preview = useUI((s) => s.preview);
  const viewedH = useUI((s) => s.viewed?.h);
  const drag = useUI((s) => s.drag);
  const cards = zone.cards;
  const dragSet = useMemo(() => new Set(drag?.handles ?? []), [drag]);
  const shown = useMemo(() => (drag ? cards.filter((c) => !dragSet.has(c.h)) : cards), [cards, drag, dragSet]);
  const cardH = cardW * 1.4;
  const pad = zonePad({ layout: 'column', cards });
  const L = useMemo(() => columnLayout(shown.map((c) => c.faceUp), cardH), [shown, cardH]);
  const Lfull = useMemo(() => columnLayout(cards.map((c) => c.faceUp), cardH), [cards, cardH]);
  const focus = preview && preview.zone === zone.id ? shown.findIndex((c) => c.h === preview.h) : -1;
  const M = useMemo(() => columnMagnify(L, focus >= 0 ? focus : null), [L, focus]);
  const selSet = new Set(selZone === zone.id ? selected : []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const raw = getComputedStyle(el).getPropertyValue('--card-w').trim();
      const cw = parseFloat(raw);
      if (cw > 0) setCardW(cw);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // drop target: always the end of the column
  useEffect(() => {
    dropRegistry.set(zone.id, () => ({}));
    return () => {
      dropRegistry.delete(zone.id);
    };
  }, [zone.id]);

  const live = useRef({ cards, zone, onInfo, interactive, Lfull });
  live.current = { cards, zone, onInfo, interactive, Lfull };
  const paint = useRef<'preview' | 'select' | 'deselect'>('preview');
  const pointer = useRef<string>('touch');
  const gesture = useMemo(() => {
    const h = (i: number) => live.current.cards[i]?.h;
    const setPreview = (i: number) => {
      const hh = h(i);
      if (!hh) return;
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
      g: new ZoneGesture(
        {
          hit: (_x, y) => drawnHit(live.current.Lfull, live.current.cards, live.current.zone.id, y),
          onTap: (i) => {
            if (i === null || !live.current.interactive) return;
            if (tapEndsViewing(h(i))) return;
            useUI.getState().toggle(live.current.zone.id, h(i)!);
          },
          onDoubleTap: (i) => {
            const hh = h(i);
            if (!hh || !live.current.interactive) return;
            useUI.getState().toggle(live.current.zone.id, hh); // undo the first tap's toggle
            void quickFlip(live.current.zone.id, hh);
          },
          onLongPress: (i) => live.current.onInfo(h(i)!),
          onScrubStart: (i) => {
            const st = useUI.getState();
            const sel = new Set(st.selZone === live.current.zone.id ? st.selected : []);
            paint.current = live.current.interactive ? paintMode(sel, h(i)!) : 'preview';
            placeLoupe(ref.current, pointer.current);
            setPreview(i);
          },
          onDwell: () => {
            if (useUI.getState().loupe) useUI.setState({ loupe: { ...useUI.getState().loupe!, details: true } });
          },
          onScrub: (i) => {
            if (useUI.getState().loupe?.details) useUI.setState({ loupe: { ...useUI.getState().loupe!, details: false } });
            setPreview(i);
          },
          onScrubEnd: () => finishScrub(pointer.current),
          onDragStart: (i, s) => {
            if (!live.current.interactive) return;
            const st = useUI.getState();
            const zid = live.current.zone.id;
            const hh = h(i)!;
            // card-handling "Picking up from a column": the card and everything below it, or the selection
            const handles =
              st.selZone === zid && st.selected.includes(hh)
                ? live.current.cards.filter((c) => st.selected.includes(c.h)).map((c) => c.h)
                : live.current.cards.slice(i).map((c) => c.h);
            useUI.setState({ preview: null });
            startDrag(handles, zid, s.x + origin.x, s.y + origin.y);
          },
          onDragMove: (s: Sample) => moveDrag(s.x + origin.x, s.y + origin.y),
          onDragEnd: (s: Sample) => endDrag(s.x + origin.x, s.y + origin.y),
          onCancel: () => cancelDrag(),
        },
        { axis: 'y', crossSize: () => ref.current?.clientWidth ?? 60 },
      ),
    };
  }, []);

  // header-scrub: a finger that slid down from this zone's header continues as a vertical scrub of the column
  useEffect(() => {
    const enter = (cx: number, cy: number, pointerId: number) => {
      const el = ref.current;
      if (!el || !live.current.cards.length) return false;
      const r = el.getBoundingClientRect();
      gesture.origin({ x: r.left, y: r.top });
      try {
        el.setPointerCapture(pointerId);
      } catch {
        /* ignore */
      }
      pointer.current = 'touch';
      const y = cy - r.top;
      const i = columnHit(live.current.Lfull, y) ?? (y < 0 ? 0 : live.current.cards.length - 1);
      gesture.g.beginScrub({ x: cx - r.left, y, t: performance.now() }, i);
      return true;
    };
    enterRegistry.set(zone.id, enter);
    return () => {
      if (enterRegistry.get(zone.id) === enter) enterRegistry.delete(zone.id);
    };
  }, [zone.id, gesture]);

  useEffect(() => {
    const t = setInterval(() => gesture.g.tick(performance.now()), 50);
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

  return (
    <div
      ref={ref}
      className={`column-cards ${focus >= 0 ? 'opened' : ''}`}
      // card-rotation: room around the column for its most rotated card, as margin so the hit-test (relative to this box) is unchanged
      style={{ height: L.height, margin: `${pad.y * cardW}px ${pad.x * cardW}px` }}
      data-zone-id={zone.id}
      data-drop-zone={zone.id}
      data-testid={`row-${zone.name}`}
      onPointerDown={(e) => {
        if (e.button === 2 || isBoardPanning()) return;
        try {
          ref.current!.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        pointer.current = e.pointerType;
        gesture.g.down(local(e));
      }}
      onPointerMove={(e) => {
        if (gesture.g.state === 'idle') {
          // desktop hover opens the cards under the pointer
          if (e.pointerType === 'mouse' && e.buttons === 0 && !drag) {
            const i = drawnHit(Lfull, cards, zone.id, local(e).y);
            const hh = i === null ? null : cards[i]?.h;
            const cur = useUI.getState().preview;
            if (hh && (cur?.h !== hh || cur.zone !== zone.id)) useUI.setState({ preview: { h: hh, zone: zone.id } });
            else if (!hh && cur?.zone === zone.id) useUI.setState({ preview: null });
          }
          return;
        }
        gesture.g.move(local(e));
      }}
      onPointerUp={(e) => gesture.g.up(local(e))}
      onPointerCancel={() => gesture.g.cancel()}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse' && gesture.g.state === 'idle' && useUI.getState().preview?.zone === zone.id) useUI.setState({ preview: null });
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        const i = columnHit(Lfull, e.clientY - ref.current!.getBoundingClientRect().top);
        if (i !== null) onInfo(cards[i].h);
      }}
    >
      {shown.map((c, i) => (
        <CardFace
          key={c.h}
          card={c}
          decks={decks}
          className={`in-column ${selSet.has(c.h) ? 'selected' : ''} ${i === focus ? 'focused' : ''} ${viewedH === c.h ? 'viewed' : ''}`}
          style={{ transform: `translateY(${M.y[i]}px)`, zIndex: i + 1 }}
        />
      ))}
      {interactive && selSet.size > 0 && (
        <span className="sel-count" data-testid="sel-count">
          {selSet.size}
        </span>
      )}
    </div>
  );
}
