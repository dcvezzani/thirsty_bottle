import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { TableDeckView, ZoneView } from '@vct/shared';
import { CardFace } from '../components/Card';
import { ZoneGesture, applyPaint, paintMode, type Sample } from './gestures';
import { cardPos, fanLayout, hitIndex, insertionIndex, magnify } from './layout';
import { useUI } from './ui';
import { dropRegistry, endDrag, moveDrag, startDrag, cancelDrag } from './drag';

function vibrate(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
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
  const L = useMemo(() => fanLayout(shown.length, width, cardW, { arc, gapAt }), [shown.length, width, cardW, arc, gapAt]);
  const Lfull = useMemo(() => fanLayout(cards.length, width, cardW, { arc }), [cards.length, width, cardW, arc]);
  const focus = preview && preview.zone === zone.id ? shown.findIndex((c) => c.h === preview.h) : -1;
  const selSet = new Set(selZone === zone.id ? selected : []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      setWidth(el.clientWidth);
      const cw = parseFloat(getComputedStyle(el).getPropertyValue('--card-w')) || 64;
      setCardW(cw * zoom);
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
  const live = useRef({ cards, zone, onInfo, draggable, interactive });
  live.current = { cards, zone, onInfo, draggable, interactive };
  const paint = useRef<'preview' | 'select' | 'deselect'>('preview');
  const lastScrub = useRef<string | null>(null);
  const gesture = useMemo(() => {
    const hit = (x: number) => hitIndex(fanLayout(live.current.cards.length, ref.current?.clientWidth ?? width, cardW, { arc }), x);
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
        hit: (x) => hit(x),
        onTap: (i) => {
          if (i === null || !live.current.interactive) return;
          useUI.getState().toggle(live.current.zone.id, h(i)!);
        },
        onLongPress: (i) => {
          vibrate(15);
          live.current.onInfo(h(i)!);
        },
        onScrubStart: (i) => {
          const st = useUI.getState();
          const sel = new Set(st.selZone === live.current.zone.id ? st.selected : []);
          paint.current = live.current.interactive ? paintMode(sel, h(i)!) : 'preview';
          lastScrub.current = null;
          setPreview(i);
        },
        onScrub: (i) => setPreview(i),
        onScrubEnd: () => {
          lastScrub.current = null;
          useUI.setState({ preview: null });
        },
        onDragStart: (i, s) => {
          if (!live.current.draggable || !live.current.interactive) return;
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
  }, [cardW, arc, width]);

  useEffect(() => {
    const t = setInterval(() => gesture.g.tick(performance.now()), 50);
    return () => clearInterval(t);
  }, [gesture]);

  const local = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    gesture.origin({ x: r.left, y: r.top });
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return;
    if (e.pointerType === 'mouse' && e.shiftKey) {
      // desktop range select
      const s = local(e);
      const i = hitIndex(Lfull, s.x);
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
    gesture.g.down(local(e));
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (gesture.g.state === 'idle') {
      // desktop hover preview
      if (e.pointerType === 'mouse' && e.buttons === 0 && !drag) {
        const i = hitIndex(Lfull, local(e).x);
        const hh = i === null ? null : cards[i]?.h;
        const cur = useUI.getState().preview;
        if (hh && (cur?.h !== hh || cur.zone !== zone.id)) useUI.setState({ preview: { h: hh, zone: zone.id } });
        else if (!hh && cur?.zone === zone.id) useUI.setState({ preview: null });
      }
      return;
    }
    gesture.g.move(local(e));
  };
  const onPointerUp = (e: React.PointerEvent) => gesture.g.up(local(e));
  const onPointerCancel = () => gesture.g.cancel();
  const onPointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && gesture.g.state === 'idle' && useUI.getState().preview?.zone === zone.id) useUI.setState({ preview: null });
  };
  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const r = ref.current!.getBoundingClientRect();
    const i = hitIndex(Lfull, e.clientX - r.left);
    if (i !== null) onInfo(cards[i].h);
  };

  const rowH = height ?? cardW * 1.4 + (arc ? cardW * 0.35 : 0) + 8;
  return (
    <div
      ref={ref}
      className={`card-row ${arc ? 'arc' : ''}`}
      style={{ height: rowH, ['--cw' as any]: `${cardW}px` }}
      data-zone-id={zone.id}
      data-testid={`row-${zone.kind === 'hand' ? 'hand' : zone.name}`}
      {...(dropId ? { 'data-drop-zone': dropId } : {})}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerLeave}
      onContextMenu={onContextMenu}
    >
      {shown.length === 0 && !drag && <div className="row-empty">{zone.kind === 'hand' ? 'Your hand is empty' : 'Empty'}</div>}
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
