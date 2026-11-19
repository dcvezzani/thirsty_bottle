import { useEffect, useRef, useState, type RefObject } from 'react';
import type { TableView, ZoneView } from '@vct/shared';
import { useTable } from '../store/table';
import { useUI } from './ui';
import { arrangeRows, type FlowItem } from './flow';
import { EdgeScroller } from './edgeScroll';

const PLACEHOLDER = '__drop__';
const send = (a: Parameters<ReturnType<typeof useTable.getState>['send']>[0]) => useTable.getState().send(a);

/** Long press (500 ms, under 8 px of movement) on a zone label: the host enters arrange mode. */
export function useArrangeLongPress(enabled: boolean) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };
  useEffect(() => clear, []);
  return {
    /** True once if the long press fired (the following click must not open the zone sheet). */
    consumeFired: () => {
      const f = fired.current;
      fired.current = false;
      return f;
    },
    handlers: enabled
      ? {
          onPointerDown: (e: React.PointerEvent) => {
            fired.current = false;
            start.current = { x: e.clientX, y: e.clientY };
            timer.current = setTimeout(() => {
              fired.current = true;
              useUI.setState({ arranging: true, sheet: null });
              try {
                navigator.vibrate?.(15);
              } catch {
                /* unsupported */
              }
            }, 500);
          },
          onPointerMove: (e: React.PointerEvent) => {
            if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) clear();
          },
          onPointerUp: clear,
          onPointerCancel: clear,
          onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
        }
      : {},
  };
}

/** The arrange-mode header: what is going on, and Done. */
export function ArrangeBar() {
  return (
    <div className="arrange-bar" role="region" aria-label="Arranging zones">
      <span className="grow">Arranging zones: drag ≡ to move</span>
      <button className="primary" onClick={() => useUI.setState({ arranging: false })}>
        Done
      </button>
    </div>
  );
}

interface TileDrag {
  id: string;
  /** Pointer offset inside the tile. */
  dx: number;
  dy: number;
  x: number;
  y: number;
  index: number;
}

/** table-play "Arranging zones": every shared zone as a tile; drag a tile's grip to move it. */
export function ArrangeBoard({ view, boardRef, boardW }: { view: TableView; boardRef: RefObject<HTMLDivElement>; boardW: number }) {
  const shared = view.zones.filter((z) => z.kind === 'shared');
  const [drag, setDragState] = useState<TileDrag | null>(null);
  const tiles = useRef(new Map<string, HTMLElement>());
  const edge = useRef(new EdgeScroller());
  const frame = useRef(0);
  const dragRef = useRef<TileDrag | null>(null);
  // the scroll loop reads the latest drag immediately, before React renders it
  const setDrag = (d: TileDrag | null) => {
    dragRef.current = d;
    setDragState(d);
  };

  // exit on Escape, and when the host role is lost
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && useUI.setState({ arranging: false });
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  useEffect(() => {
    if (!view.me.isHost) useUI.setState({ arranging: false });
  }, [view.me.isHost]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const others = drag ? shared.filter((z) => z.id !== drag.id) : shared;
  const order: (ZoneView | typeof PLACEHOLDER)[] = drag ? [...others.slice(0, drag.index), PLACEHOLDER, ...others.slice(drag.index)] : shared;
  const dragged = drag ? shared.find((z) => z.id === drag.id)! : null;
  const rows = arrangeRows(
    order.map((z) =>
      z === PLACEHOLDER
        ? { id: PLACEHOLDER, layout: dragged!.layout, width: dragged!.width, newRow: dragged!.newRow }
        : { id: z.id, layout: z.layout, width: z.width, newRow: z.newRow },
    ),
    boardW,
  );

  /** Where the dragged tile would land: before the first other tile the pointer is above or left of. */
  const indexAt = (x: number, y: number, id: string) => {
    const list = shared.filter((z) => z.id !== id);
    for (let i = 0; i < list.length; i++) {
      const el = tiles.current.get(list[i].id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (y < r.top || (y <= r.bottom && x < r.left + r.width / 2)) return i;
    }
    return list.length;
  };

  const tick = (now: number) => {
    frame.current = 0;
    const d = dragRef.current;
    const board = boardRef.current;
    if (!d || !board) return;
    const r = board.getBoundingClientRect();
    const v = edge.current.speed(d.y, now, r.top, r.bottom);
    if (v) {
      board.scrollTop += v / 60;
      setDrag({ ...d, index: indexAt(d.x, d.y, d.id) });
    }
    frame.current = requestAnimationFrame(tick);
  };

  // The dragged tile leaves the layout (a placeholder takes its place), which unmounts its grip,
  // so the drag is followed with window listeners rather than pointer capture.
  const onGripDown = (z: ZoneView) => (e: React.PointerEvent) => {
    e.preventDefault();
    const el = tiles.current.get(z.id)!;
    const r = el.getBoundingClientRect();
    const pid = e.pointerId;
    const idx = shared.findIndex((s) => s.id === z.id);
    setDrag({ id: z.id, dx: e.clientX - r.left, dy: e.clientY - r.top, x: e.clientX, y: e.clientY, index: idx });
    edge.current.reset();
    frame.current = requestAnimationFrame(tick);
    const move = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (ev.pointerId !== pid || !d) return;
      ev.preventDefault();
      setDrag({ ...d, x: ev.clientX, y: ev.clientY, index: indexAt(ev.clientX, ev.clientY, d.id) });
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const d = dragRef.current;
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      setDrag(null);
      if (!d || ev.type === 'pointercancel') return;
      const from = shared.findIndex((s) => s.id === d.id);
      if (from !== d.index) send({ type: 'zoneMove', zone: d.id, index: d.index });
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const byId = new Map(shared.map((z) => [z.id, z]));
  return (
    <div className="arrange-board">
      {rows.map((row, ri) => (
        <div className="zone-row" key={ri}>
          {row.map((it: FlowItem) =>
            it.id === PLACEHOLDER ? (
              <div key={PLACEHOLDER} className="arrange-tile placeholder" style={{ width: it.w }} aria-hidden="true" />
            ) : (
              <Tile key={it.id} zone={byId.get(it.id)!} w={it.w} tileRef={(el) => (el ? tiles.current.set(it.id, el) : tiles.current.delete(it.id))} onGripDown={onGripDown(byId.get(it.id)!)} />
            ),
          )}
        </div>
      ))}
      {drag && dragged && (
        <div className="arrange-tile dragging" style={{ width: tiles.current.get(drag.id)?.offsetWidth ?? 108, left: drag.x - drag.dx, top: drag.y - drag.dy, ['--zone-color' as any]: dragged.color }} aria-hidden="true">
          <span className="grip">≡</span> {dragged.name}
        </div>
      )}
    </div>
  );
}

function Tile({
  zone,
  w,
  tileRef,
  onGripDown,
}: {
  zone: ZoneView;
  w: number;
  tileRef: (el: HTMLElement | null) => void;
  onGripDown: (e: React.PointerEvent) => void;
}) {
  return (
    <section ref={tileRef} className="arrange-tile" style={{ width: w, ['--zone-color' as any]: zone.color }} aria-label={`${zone.name} tile`}>
      <div className="row tile-head">
        <button className="grip" aria-label={`Move ${zone.name}`} onPointerDown={onGripDown}>
          ≡
        </button>
        <span className="tile-name">{zone.name}</span>
      </div>
      <select aria-label={`${zone.name} width`} value={zone.width} onChange={(e) => send({ type: 'zoneUpdate', zone: zone.id, width: e.target.value as ZoneView['width'] })}>
        <option value="fit">Fit</option>
        <option value="half">Half</option>
        <option value="full">Full</option>
      </select>
      <button className={`small ${zone.newRow ? 'primary' : ''}`} aria-pressed={zone.newRow} aria-label={`${zone.name} starts a new row`} onClick={() => send({ type: 'zoneUpdate', zone: zone.id, newRow: !zone.newRow })}>
        New row
      </button>
    </section>
  );
}
