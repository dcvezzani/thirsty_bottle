import { useEffect, useMemo, useRef } from 'react';
import type { CardView, TableDeckView, TableView, ZoneView } from '@vct/shared';
import { CardFace } from '../components/Card';
import { CardRow, finishScrub, placeLoupe } from './CardRow';
import { endFaceDown } from './pileFaceDown';
import { ColumnZone } from './ColumnZone';
import { ZoneGesture } from './gestures';
import { useUI, zoneLabel } from './ui';
import { cancelDrag, dropRegistry, endDrag, moveDrag, startDrag } from './drag';
import { isBoardPanning, onCancelCardGestures } from './pan';
import type { FlowItem } from './flow';
import { useZoneHeader } from './headerScrub';
import { registerHeader } from './scrubStrip';
import { zoneFocusCard } from './focusCard';
import { pileCorner, pileShown, zonePad } from './rotation';
import { quickFlip } from './flip';
import { RelativeScrub } from './scrubGain';

function vibrate(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
}

/** Pile: stacked, top card visible. Tap = pile actions, drag = take the top card, hold = info. */
export function Pile({
  zone,
  decks,
  onInfo,
  canAct,
  readOnly = false,
  testId,
  fanned = false,
}: {
  zone: ZoneView;
  decks: TableDeckView[];
  onInfo: (h: string) => void;
  canAct: boolean;
  /** table-overview: drawn as on the table, but nothing can be pressed, dragged or dropped on it. */
  readOnly?: boolean;
  testId?: string;
  /** pile-scrub: the pile is shown fanned out above it while it is scrubbed; it stays here to carry the finger. */
  fanned?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useUI((s) => s.drag);
  const visible = drag ? zone.cards.filter((c) => !drag.handles.includes(c.h)) : zone.cards;
  const top = visible[0];
  const selZone = useUI((s) => s.selZone);
  const selected = useUI((s) => s.selected);
  const selCount = selZone === zone.id ? zone.cards.filter((c) => selected.includes(c.h)).length : 0;
  const live = useRef({ zone, canAct });
  live.current = { zone, canAct };
  const pointer = useRef('touch');
  /** pile-scrub: where the pile was when the press began; the pile can move (the zone widening or collapsing) during a press. */
  const anchor = useRef<{ left: number; top: number } | null>(null);
  const rel = useRef<RelativeScrub | null>(null);
  const lastPreview = useRef<string | null>(null);
  const g = useMemo(() => {
    let origin = { x: 0, y: 0 };
    const preview = (i: number) => {
      const hh = live.current.zone.cards[i]?.h;
      if (!hh) return;
      if (hh !== lastPreview.current) vibrate(5);
      lastPreview.current = hh;
      useUI.setState({ preview: { h: hh, zone: live.current.zone.id } });
    };
    // quick-flip: a single tap opens the sheet after a short pause, so a second tap can flip the top card
    let tapTimer: ReturnType<typeof setTimeout> | null = null;
    const openSheet = () => useUI.getState().setSheet({ kind: 'zone', zone: live.current.zone.id });
    return {
      origin: (o: { x: number; y: number }) => (origin = o),
      cancelTap: () => tapTimer && clearTimeout(tapTimer),
      g: new ZoneGesture(
        {
          hit: () => (live.current.zone.cards.length ? 0 : null),
          // pile-scrub: the card follows how far the finger travels, slowly for precision and fast to cover the pile
          scrubAt: (s) => rel.current?.update(s) ?? null,
          onScrubStart: (i) => {
            // pile-scrub: the pile opens in place as a spread and the loupe scrubs it
            endFaceDown();
            placeLoupe(ref.current, pointer.current);
            lastPreview.current = null;
            useUI.setState({ pileScrub: { zone: live.current.zone.id }, openZone: { id: live.current.zone.id, pinned: false } });
            preview(i);
          },
          onScrub: (i) => {
            const l = useUI.getState().loupe;
            if (l?.details) useUI.setState({ loupe: { ...l, details: false } });
            preview(i);
          },
          onDwell: () => {
            const l = useUI.getState().loupe;
            if (l) useUI.setState({ loupe: { ...l, details: true } });
          },
          onScrubEnd: () => {
            const oz = useUI.getState().openZone;
            useUI.setState({ pileScrub: null, ...(oz?.id === live.current.zone.id && !oz.pinned ? { openZone: null } : {}) });
            finishScrub(pointer.current);
          },
          onTap: (i) => {
            if (tapTimer) clearTimeout(tapTimer);
            if (i === null || !live.current.canAct) return openSheet();
            tapTimer = setTimeout(() => {
              tapTimer = null;
              openSheet();
            }, 250);
          },
          onDoubleTap: () => {
            if (tapTimer) clearTimeout(tapTimer);
            tapTimer = null;
            const c = live.current.zone.cards[0];
            if (c && live.current.canAct) void quickFlip(live.current.zone.id, c.h);
          },
          onLongPress: () => live.current.zone.cards[0] && onInfo(live.current.zone.cards[0].h),
          onDragStart: (i, s) => {
            // a plain pull takes the top card; pulling out of a scrub takes the card that was scrubbed
            const c = live.current.zone.cards[i] ?? live.current.zone.cards[0];
            if (!c || !live.current.canAct) return;
            // card-handling "Moving a whole pile": a selected pile carries its selected cards, in pile order
            const st = useUI.getState();
            const zid = live.current.zone.id;
            const handles =
              st.selZone === zid && st.selected.includes(c.h)
                ? live.current.zone.cards.filter((x) => st.selected.includes(x.h)).map((x) => x.h)
                : [c.h];
            startDrag(handles, zid, s.x + origin.x, s.y + origin.y);
          },
          // tap, then press again: cancel the pending sheet; if that press moves, drag the whole pile
          onSecondPress: () => {
            if (tapTimer) clearTimeout(tapTimer);
            tapTimer = null;
          },
          onSecondPressDrag: (_i, s) => {
            const cards = live.current.zone.cards;
            if (!cards.length || !live.current.canAct) return;
            startDrag(
              cards.map((x) => x.h),
              live.current.zone.id,
              s.x + origin.x,
              s.y + origin.y,
            );
          },
          onDragMove: (s) => moveDrag(s.x + origin.x, s.y + origin.y),
          onDragEnd: (s) => endDrag(s.x + origin.x, s.y + origin.y),
          onCancel: () => cancelDrag(),
        },
        { scrub: true },
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
      g.cancelTap();
    };
  }, [g]);
  const local = (e: React.PointerEvent) => {
    const r = anchor.current ?? ref.current!.getBoundingClientRect();
    g.origin({ x: r.left, y: r.top });
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
  };
  const depth = Math.min(4, Math.ceil(visible.length / 10));
  // card-rotation: room around the pile for the cards it draws (margin, so the gesture's coordinates are unchanged);
  // pile-corner-stack: a pile with differently turned cards lines them up by their bottom-left corners, so its room is to the right and above only
  const drawn = pileShown(visible.map((c) => c.rot ?? 0)).map((i) => visible[i]);
  const beneath = drawn.slice(1);
  const arr = pileCorner(drawn.map((c) => c.rot ?? 0));
  const room = arr.corner ? { t: arr.top, r: arr.right, b: 0, l: 0 } : (() => { const p = zonePad({ layout: 'pile', cards: visible }); return { t: p.y, r: p.x, b: p.y, l: p.x }; })();
  const calcOf = (f: number) => `calc(var(--card-w) * ${f})`;
  const shiftOf = (c: { rot?: number }) => (arr.corner ? arr.place(c.rot ?? 0) : undefined);
  return (
    <div
      ref={ref}
      className={`pile${fanned ? ' fanned' : ''}`}
      style={
        room.t || room.r || room.b || room.l
          ? {
              margin: `${calcOf(room.t)} ${calcOf(room.r)} ${calcOf(room.b)} ${calcOf(room.l)}`,
              ['--pad-t' as any]: calcOf(room.t),
              ['--pad-r' as any]: calcOf(room.r),
              ['--pad-b' as any]: calcOf(room.b),
              ['--pad-l' as any]: calcOf(room.l),
            }
          : undefined
      }
      data-testid={testId ?? `pile-${zone.name}`}
      {...(readOnly
        ? { onClick: () => top && onInfo(top.h) }
        : {
            'data-drop-zone': zone.id,
            'data-zone-id': zone.id,
            onPointerDown: (e: React.PointerEvent) => {
              if (e.button === 2 || isBoardPanning()) return;
              ref.current!.setPointerCapture(e.pointerId);
              anchor.current = ref.current!.getBoundingClientRect();
              pointer.current = e.pointerType;
              // the mouse keeps its drag; touch and pen scrub, except a selected pile, whose sideways drag still carries its selection
              const st = useUI.getState();
              const top = live.current.zone.cards[0];
              const selected = st.selZone === live.current.zone.id && !!top && st.selected.includes(top.h);
              g.g.allowScrub(e.pointerType !== 'mouse' && !selected);
              rel.current = new RelativeScrub(live.current.zone.cards.length, 0, { x: e.clientX - anchor.current!.left, t: performance.now() }, window.innerWidth); // same coordinates as the gesture's samples
              g.g.down(local(e));
            },
            onPointerMove: (e: React.PointerEvent) => g.g.state !== 'idle' && g.g.move(local(e)),
            onPointerUp: (e: React.PointerEvent) => {
              g.g.up(local(e));
              anchor.current = null;
            },
            onPointerCancel: () => {
              g.g.cancel();
              anchor.current = null;
            },
            onContextMenu: (e: React.MouseEvent) => {
              e.preventDefault();
              if (top) onInfo(top.h);
            },
          })}
    >
      {Array.from({ length: depth }, (_, i) => (
        <div
          key={i}
          className="card pile-under"
          style={{ transform: `translate(${(depth - i) * 1.5}px, ${(depth - i) * 1.5}px)` }}
        >
          <div className="gen-back" />
        </div>
      ))}
      {/* pile-shows-turned: the first card of each other outline beneath the top card, as it really is, so a differently turned
          card sticks out and can be seen. Deepest first; decoration only (no handle, not tappable). */}
      {[...beneath].reverse().map((c) => (
        <CardFace key={c.h} card={c} decks={decks} decorative turnShift={shiftOf(c)} className="pile-beneath" />
      ))}
      {top ? <CardFace card={top} decks={decks} turnShift={shiftOf(top)} className={`pile-top ${selCount ? 'selected' : ''}`} /> : <div className="card slot" />}
      {selCount > 0 && (
        <span className="sel-count" data-testid="sel-count">
          {selCount}
        </span>
      )}
      <span className="pile-count" aria-label={`${visible.length} cards`}>
        {visible.length}
      </span>
    </div>
  );
}

/** Free layout: cards placed anywhere. */
export function FreeZone({
  zone,
  decks,
  onInfo,
  canAct,
  readOnly = false,
}: {
  zone: ZoneView;
  decks: TableDeckView[];
  onInfo: (h: string) => void;
  canAct: boolean;
  /** table-overview: drawn as on the table, but nothing can be pressed, dragged or dropped on it. */
  readOnly?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const selZone = useUI((s) => s.selZone);
  const selected = useUI((s) => s.selected);
  const drag = useUI((s) => s.drag);
  useEffect(() => {
    if (readOnly) return;
    dropRegistry.set(zone.id, (x, y) => {
      const r = ref.current!.getBoundingClientRect();
      return {
        pos: {
          x: Math.max(0, Math.min(1, (x - r.left) / r.width - 0.05)),
          y: Math.max(0, Math.min(1, (y - r.top) / r.height - 0.1)),
        },
      };
    });
    return () => {
      dropRegistry.delete(zone.id);
    };
  }, [zone.id, readOnly]);
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
          onTap: (i) =>
            i === null
              ? useUI.getState().setSheet({ kind: 'zone', zone: live.current.zone.id })
              : useUI.getState().toggle(live.current.zone.id, live.current.zone.cards[i].h),
          onDoubleTap: (i) => {
            const h = live.current.zone.cards[i]?.h;
            if (!h || !live.current.canAct) return;
            useUI.getState().toggle(live.current.zone.id, h); // undo the first tap's toggle
            void quickFlip(live.current.zone.id, h);
          },
          onLongPress: (i) => onInfo(live.current.zone.cards[i].h),
          onDragStart: (i, s) => {
            if (!live.current.canAct) return;
            const st = useUI.getState();
            const hh = live.current.zone.cards[i].h;
            const handles =
              st.selZone === live.current.zone.id && st.selected.includes(hh) ? st.selected : [hh];
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
      {...(readOnly
        ? { onClick: (e: React.MouseEvent) => { const h = (e.target as Element).closest('[data-h]')?.getAttribute('data-h'); if (h) onInfo(h); } }
        : {
            'data-drop-zone': zone.id,
            'data-zone-id': zone.id,
            onPointerDown: (e: React.PointerEvent) => {
              if (e.button === 2 || isBoardPanning()) return;
              ref.current!.setPointerCapture(e.pointerId);
              g.g.down(local(e));
            },
            onPointerMove: (e: React.PointerEvent) => g.g.state !== 'idle' && g.g.move(local(e)),
            onPointerUp: (e: React.PointerEvent) => g.g.up(local(e)),
            onPointerCancel: () => g.g.cancel(),
          })}
    >
      {zone.cards
        .filter((c) => !drag?.handles.includes(c.h))
        .map((c: CardView, i) => (
          <CardFace
            key={c.h}
            card={c}
            decks={decks}
            className={sel.has(c.h) ? 'selected' : ''}
            style={{
              position: 'absolute',
              left: `${(c.x ?? 0.05 + (i % 8) * 0.1) * 100}%`,
              top: `${(c.y ?? 0.05) * 100}%`,
              zIndex: i + 1,
            }}
          />
        ))}
    </div>
  );
}

/** A shared zone with its label (tap the label for zone actions). */
export function ZoneBox({
  view,
  zone,
  onInfo,
  flow,
  readOnly = false,
}: {
  view: TableView;
  zone: ZoneView;
  onInfo: (h: string) => void;
  flow?: FlowItem;
  /** table-overview: the zone drawn as it is on the table (its layout and width), with nothing to press, drag or drop. */
  readOnly?: boolean;
}) {
  const setSheet = useUI((s) => s.setSheet);
  const canAct = !view.me.spectator;
  const over = useUI((s) => s.drag?.over);
  const isOver = over?.kind === 'zone' && over.zone === zone.id;
  const opened = useUI((s) => s.openZone?.id === zone.id);
  const fanned = useUI((s) => s.pileScrub?.zone === zone.id);
  const slim = !!flow && zone.cards.length === 0 && zone.layout !== 'pile' && !isOver;
  const sectionRef = useRef<HTMLElement>(null);
  const header = useZoneHeader({ zoneId: zone.id, sectionRef, host: view.me.isHost, onTap: () => setSheet({ kind: 'zone', zone: zone.id }) });
  // header-scrub: this zone's header can be reached by a slide along the headers
  const focus = zoneFocusCard(zone);
  const headerName = `${zone.kind === 'player' ? zoneLabel(view, zone) : zone.name} · ${zone.cards.length}`;
  useEffect(() => {
    const el = sectionRef.current;
    if (readOnly || !el || !focus) return;
    return registerHeader(zone.id, {
      el,
      name: headerName,
      extent: () => ({ left: 0, right: el.getBoundingClientRect().width }),
      indexAt: () => 0,
      show: () => {
        const cur = useUI.getState().preview;
        if (cur?.h !== focus.h) vibrate(5);
        const l = useUI.getState().loupe;
        useUI.setState({ preview: { h: focus.h, zone: zone.id }, ...(l?.details ? { loupe: { ...l, details: false } } : {}) });
      },
    });
  }, [zone.id, focus?.h, headerName, readOnly]);
  return (
    <section
      ref={sectionRef}
      {...(readOnly ? { 'data-testid': `ov-zone-${zone.name}` } : { 'data-header-zone': zone.id, 'data-drop-zone': zone.id })}
      data-count={zone.cards.length}
      className={`zone zone-${zone.layout} ${flow ? `w-${flow.width}` : ''} ${slim ? 'slim' : ''} ${isOver ? 'drop-over' : ''} ${opened ? 'is-open' : ''}`}
      style={{
        ['--zone-color' as any]: zone.color,
        ...(flow ? { width: flow.w, ['--card-w' as any]: `${flow.cardW}px` } : {}),
      }}
      aria-label={zone.name}
    >
      {readOnly ? (
        <div className="zone-label">
          <span className="zone-name">{zone.name}</span>
          <span className="zone-count muted">· {zone.cards.length}</span>
        </div>
      ) : (
        <button className="zone-label" aria-label={`${zone.name} actions`} {...header.handlers}>
          {/* table-play "Zone card count": the name shortens, the count never does */}
          <span className="zone-name">{zone.kind === 'player' ? zoneLabel(view, zone) : zone.name}</span>
          <span className="zone-count muted">· {zone.cards.length}</span>
        </button>
      )}
      {slim ? (
        // card-handling "Slim empty zones": a tap-height bar that opens while cards are dragged over it
        <div className="slim-drop" data-testid={`row-${zone.name}`}>
          {flow?.width !== 'fit' && <span className="row-empty">Empty</span>}
        </div>
      ) : (
        <>
          {zone.layout === 'pile' && (
            <div className="pile-wrap">
              <Pile zone={zone} decks={view.decks} onInfo={onInfo} canAct={canAct} readOnly={readOnly} testId={readOnly ? `ov-pile-${zone.name}` : undefined} fanned={fanned && !readOnly} />
              {fanned && !readOnly && (
                <div className="pile-fan" data-testid={`pile-fan-${zone.name}`} aria-hidden>
                  <CardRow zone={{ ...zone, layout: 'spread' }} decks={view.decks} interactive={false} draggable={false} onInfo={onInfo} testId={`fan-${zone.name}`} />
                </div>
              )}
            </div>
          )}
          {zone.layout === 'spread' &&
            (readOnly ? (
              <CardRow zone={zone} decks={view.decks} interactive={false} draggable={false} onInfo={onInfo} onTapCard={onInfo} testId={`ov-row-${zone.name}`} emptyText="Empty" />
            ) : (
              <CardRow zone={zone} decks={view.decks} interactive={canAct} dropId={zone.id} onInfo={onInfo} strip />
            ))}
          {zone.layout === 'column' && <ColumnZone zone={zone} decks={view.decks} interactive={canAct && !readOnly} onInfo={onInfo} onTapCard={readOnly ? onInfo : undefined} />}
          {zone.layout === 'free' && (
            <FreeZone zone={zone} decks={view.decks} onInfo={onInfo} canAct={canAct && !readOnly} readOnly={readOnly} />
          )}
        </>
      )}
    </section>
  );
}
