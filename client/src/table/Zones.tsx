import { useEffect, useMemo, useRef } from 'react';
import type { CardView, TableDeckView, TableView, ZoneView } from '@vct/shared';
import { CardFace } from '../components/Card';
import { CardRow } from './CardRow';
import { ZoneGesture } from './gestures';
import { useUI } from './ui';
import { cancelDrag, dropRegistry, endDrag, moveDrag, startDrag } from './drag';
import { isBoardPanning, onCancelCardGestures } from './pan';

/** Pile: stacked, top card visible. Tap = pile actions, drag = take the top card, hold = info. */
export function Pile({ zone, decks, onInfo, canAct }: { zone: ZoneView; decks: TableDeckView[]; onInfo: (h: string) => void; canAct: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useUI((s) => s.drag);
  const visible = drag ? zone.cards.filter((c) => !drag.handles.includes(c.h)) : zone.cards;
  const top = visible[0];
  const live = useRef({ zone, canAct });
  live.current = { zone, canAct };
  const g = useMemo(() => {
    let origin = { x: 0, y: 0 };
    return {
      origin: (o: { x: number; y: number }) => (origin = o),
      g: new ZoneGesture(
        {
          hit: () => (live.current.zone.cards.length ? 0 : null),
          onTap: () => useUI.getState().setSheet({ kind: 'zone', zone: live.current.zone.id }),
          onLongPress: () => live.current.zone.cards[0] && onInfo(live.current.zone.cards[0].h),
          onDragStart: (_i, s) => {
            const c = live.current.zone.cards[0];
            if (c && live.current.canAct) startDrag([c.h], live.current.zone.id, s.x + origin.x, s.y + origin.y);
          },
          onDragMove: (s) => moveDrag(s.x + origin.x, s.y + origin.y),
          onDragEnd: (s) => endDrag(s.x + origin.x, s.y + origin.y),
          onCancel: () => cancelDrag(),
        },
        { scrub: false },
      ),
    };
  }, [onInfo]);
  useEffect(() => {
    const t = setInterval(() => g.g.tick(performance.now()), 50);
    // a second finger on the board means "scroll": drop whatever this finger started (table-scrolling)
    const off = onCancelCardGestures(() => g.g.cancel());
    return () => {
      clearInterval(t);
      off();
    };
  }, [g]);
  const local = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    g.origin({ x: r.left, y: r.top });
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
  };
  const depth = Math.min(4, Math.ceil(visible.length / 10));
  return (
    <div
      ref={ref}
      className="pile"
      data-drop-zone={zone.id}
      data-zone-id={zone.id}
      data-testid={`pile-${zone.name}`}
      onPointerDown={(e) => {
        if (e.button === 2 || isBoardPanning()) return;
        ref.current!.setPointerCapture(e.pointerId);
        g.g.down(local(e));
      }}
      onPointerMove={(e) => g.g.state !== 'idle' && g.g.move(local(e))}
      onPointerUp={(e) => g.g.up(local(e))}
      onPointerCancel={() => g.g.cancel()}
      onContextMenu={(e) => {
        e.preventDefault();
        if (top) onInfo(top.h);
      }}
    >
      {Array.from({ length: depth }, (_, i) => (
        <div key={i} className="card pile-under" style={{ transform: `translate(${(depth - i) * 1.5}px, ${(depth - i) * 1.5}px)` }}>
          <div className="gen-back" />
        </div>
      ))}
      {top ? <CardFace card={top} decks={decks} className="pile-top" /> : <div className="card slot" />}
      <span className="pile-count" aria-label={`${visible.length} cards`}>
        {visible.length}
      </span>
    </div>
  );
}

/** Free layout: cards placed anywhere. */
export function FreeZone({ zone, decks, onInfo, canAct }: { zone: ZoneView; decks: TableDeckView[]; onInfo: (h: string) => void; canAct: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const selZone = useUI((s) => s.selZone);
  const selected = useUI((s) => s.selected);
  const drag = useUI((s) => s.drag);
  useEffect(() => {
    dropRegistry.set(zone.id, (x, y) => {
      const r = ref.current!.getBoundingClientRect();
      return { pos: { x: Math.max(0, Math.min(1, (x - r.left) / r.width - 0.05)), y: Math.max(0, Math.min(1, (y - r.top) / r.height - 0.1)) } };
    });
    return () => {
      dropRegistry.delete(zone.id);
    };
  }, [zone.id]);
  const live = useRef({ zone, canAct });
  live.current = { zone, canAct };
  const g = useMemo(() => {
    let origin = { x: 0, y: 0 };
    const hit = (x: number, y: number) => {
      const el = ref.current;
      if (!el) return null;
      const cards = live.current.zone.cards;
      for (let i = cards.length - 1; i >= 0; i--) {
        const ce = el.querySelector<HTMLElement>(`[data-h="${cards[i].h}"]`);
        if (!ce) continue;
        const r = ce.getBoundingClientRect();
        const ox = x + origin.x;
        const oy = y + origin.y;
        if (ox >= r.left && ox <= r.right && oy >= r.top && oy <= r.bottom) return i;
      }
      return null;
    };
    return {
      origin: (o: { x: number; y: number }) => (origin = o),
      g: new ZoneGesture(
        {
          hit,
          onTap: (i) => (i === null ? useUI.getState().setSheet({ kind: 'zone', zone: live.current.zone.id }) : useUI.getState().toggle(live.current.zone.id, live.current.zone.cards[i].h)),
          onLongPress: (i) => onInfo(live.current.zone.cards[i].h),
          onDragStart: (i, s) => {
            if (!live.current.canAct) return;
            const st = useUI.getState();
            const hh = live.current.zone.cards[i].h;
            const handles = st.selZone === live.current.zone.id && st.selected.includes(hh) ? st.selected : [hh];
            startDrag(handles, live.current.zone.id, s.x + origin.x, s.y + origin.y);
          },
          onDragMove: (s) => moveDrag(s.x + origin.x, s.y + origin.y),
          onDragEnd: (s) => endDrag(s.x + origin.x, s.y + origin.y),
          onCancel: () => cancelDrag(),
        },
        { scrub: false },
      ),
    };
  }, [onInfo]);
  useEffect(() => {
    const t = setInterval(() => g.g.tick(performance.now()), 50);
    // a second finger on the board means "scroll": drop whatever this finger started (table-scrolling)
    const off = onCancelCardGestures(() => g.g.cancel());
    return () => {
      clearInterval(t);
      off();
    };
  }, [g]);
  const local = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    g.origin({ x: r.left, y: r.top });
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
  };
  const sel = new Set(selZone === zone.id ? selected : []);
  return (
    <div
      ref={ref}
      className="free-zone"
      data-drop-zone={zone.id}
      data-zone-id={zone.id}
      onPointerDown={(e) => {
        if (e.button === 2 || isBoardPanning()) return;
        ref.current!.setPointerCapture(e.pointerId);
        g.g.down(local(e));
      }}
      onPointerMove={(e) => g.g.state !== 'idle' && g.g.move(local(e))}
      onPointerUp={(e) => g.g.up(local(e))}
      onPointerCancel={() => g.g.cancel()}
    >
      {zone.cards
        .filter((c) => !drag?.handles.includes(c.h))
        .map((c: CardView, i) => (
          <CardFace
            key={c.h}
            card={c}
            decks={decks}
            className={sel.has(c.h) ? 'selected' : ''}
            style={{ position: 'absolute', left: `${(c.x ?? 0.05 + (i % 8) * 0.1) * 100}%`, top: `${(c.y ?? 0.05) * 100}%`, zIndex: i + 1 }}
          />
        ))}
    </div>
  );
}

/** A shared zone with its label (tap the label for zone actions). */
export function ZoneBox({ view, zone, onInfo }: { view: TableView; zone: ZoneView; onInfo: (h: string) => void }) {
  const setSheet = useUI((s) => s.setSheet);
  const canAct = !view.me.spectator;
  const over = useUI((s) => s.drag?.over);
  const isOver = over?.kind === 'zone' && over.zone === zone.id;
  return (
    <section className={`zone zone-${zone.layout} ${isOver ? 'drop-over' : ''}`} style={{ ['--zone-color' as any]: zone.color }} aria-label={zone.name}>
      <button className="zone-label" onClick={() => setSheet({ kind: 'zone', zone: zone.id })} aria-label={`${zone.name} actions`}>
        {zone.name} <span className="muted">· {zone.cards.length}</span>
      </button>
      {zone.layout === 'pile' && <Pile zone={zone} decks={view.decks} onInfo={onInfo} canAct={canAct} />}
      {zone.layout === 'spread' && <CardRow zone={zone} decks={view.decks} interactive={canAct} dropId={zone.id} onInfo={onInfo} />}
      {zone.layout === 'free' && <FreeZone zone={zone} decks={view.decks} onInfo={onInfo} canAct={canAct} />}
    </section>
  );
}
