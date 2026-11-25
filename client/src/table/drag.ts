import type { TableView } from '@vct/shared';
import { getSocket } from '../store/app';
import { useTable } from '../store/table';
import { predictMove } from '../store/predict';
import { useUI, type DropTarget } from './ui';
import { EdgeScroller, bandSpeed } from './edgeScroll';

/** Drop-target resolvers registered by rendered zones: client point → insertion index / free position. */
export const dropRegistry = new Map<string, (x: number, y: number) => { index?: number; pos?: { x: number; y: number } }>();

let lastSent = 0;
let boardEl: HTMLElement | null = null;
export function setBoardElement(el: HTMLElement | null) {
  boardEl = el;
}

function boardCoords(x: number, y: number) {
  const r = boardEl?.getBoundingClientRect();
  if (!r) return { x: 0, y: 0 };
  return { x: (x - r.left) / Math.max(1, r.width), y: (y - r.top) / Math.max(1, r.height) };
}

function broadcast(x: number, y: number, end = false) {
  const t = useTable.getState();
  const d = useUI.getState().drag;
  if (!t.tableId || !d) return;
  const now = performance.now();
  if (!end && now - lastSent < 66) return; // ~15 Hz
  lastSent = now;
  const p = boardCoords(x, y);
  getSocket()?.send({ t: 'table.drag', tableId: t.tableId, handles: d.handles, x: p.x, y: p.y, ...(end ? { end: true } : {}) });
}

export function targetAt(x: number, y: number): DropTarget {
  const els = document.elementsFromPoint(x, y) as HTMLElement[];
  for (const el of els) {
    const seat = el.closest<HTMLElement>('[data-drop-seat]');
    if (seat) return { kind: 'seat', seat: seat.dataset.dropSeat! };
    const zone = el.closest<HTMLElement>('[data-drop-zone]');
    if (zone) {
      const id = zone.dataset.dropZone!;
      const r = dropRegistry.get(id)?.(x, y) ?? {};
      return { kind: 'zone', zone: id, ...r };
    }
  }
  return null;
}

// --- scrolling while dragging (table-scrolling) ---
const edge = new EdgeScroller();
let edgeFrame = 0;
let edgeLast = 0;
function edgeTick(now: number) {
  edgeFrame = 0;
  const d = useUI.getState().drag;
  if (!d || !boardEl) return edge.reset();
  const r = boardEl.getBoundingClientRect();
  const v = edge.speed(d.y, now, r.top, r.bottom);
  const dt = Math.min(50, now - (edgeLast || now));
  edgeLast = now;
  if (v !== 0) {
    const before = boardEl.scrollTop;
    boardEl.scrollTop += (v * dt) / 1000;
    // the zone under the cards changed: re-evaluate the drop target
    if (boardEl.scrollTop !== before) useUI.setState({ drag: { ...d, over: targetAt(d.x, d.y) } });
  }
  if (bandActive(d.y, r)) edgeFrame = requestAnimationFrame(edgeTick);
  else edge.reset();
}
function bandActive(y: number, r: DOMRect) {
  return bandSpeed(y, r.top, r.bottom) !== 0;
}
function edgeWatch(y: number) {
  if (!boardEl || edgeFrame) return;
  if (!bandActive(y, boardEl.getBoundingClientRect())) return;
  edgeLast = 0;
  edgeFrame = requestAnimationFrame(edgeTick);
}
function edgeStop() {
  cancelAnimationFrame(edgeFrame);
  edgeFrame = 0;
  edge.reset();
}

// --- scrub-loupe: a held drag opens the zone under the cards so a slot can be aimed at ---
export const OPEN_DWELL_MS = 300;
const OPEN_EXIT_MARGIN = 16;
let rest = { x: 0, y: 0, t: 0 };
let dwellTimer: ReturnType<typeof setInterval> | null = null;

/** A zone can open in place only when it is a spread with room to give (a fit-width card row on the board). */
function openable(id: string) {
  return !!document.querySelector(`.zone.zone-spread.w-fit[data-drop-zone="${CSS.escape(id)}"]`);
}

function dwellTick() {
  const d = useUI.getState().drag;
  if (!d) return stopDwell();
  const now = performance.now();
  if (Math.hypot(d.x - rest.x, d.y - rest.y) > 8) rest = { x: d.x, y: d.y, t: now };
  const open = useUI.getState().openZone;
  if (open) {
    // stays open until the finger has clearly left the zone, so shifting neighbours cannot make it flicker
    const el = document.querySelector(`[data-drop-zone="${CSS.escape(open.id)}"]`);
    const r = el?.getBoundingClientRect();
    const inside = !!r && d.x >= r.left - OPEN_EXIT_MARGIN && d.x <= r.right + OPEN_EXIT_MARGIN && d.y >= r.top - OPEN_EXIT_MARGIN && d.y <= r.bottom + OPEN_EXIT_MARGIN;
    if (!inside && !open.pinned) useUI.setState({ openZone: null });
  }
  if (now - rest.t >= OPEN_DWELL_MS && d.over?.kind === 'zone' && d.over.zone !== open?.id && openable(d.over.zone)) {
    useUI.setState({ openZone: { id: d.over.zone, pinned: false } });
  }
}
function stopDwell() {
  if (dwellTimer) clearInterval(dwellTimer);
  dwellTimer = null;
}

export function startDrag(handles: string[], fromZone: string, x: number, y: number) {
  useUI.setState({ drag: { handles, fromZone, x, y, over: null }, preview: null, loupe: null });
  rest = { x, y, t: performance.now() };
  stopDwell();
  dwellTimer = setInterval(dwellTick, 60);
  broadcast(x, y);
  edgeWatch(y);
}

export function moveDrag(x: number, y: number) {
  const d = useUI.getState().drag;
  if (!d) return;
  useUI.setState({ drag: { ...d, x, y, over: targetAt(x, y) } });
  broadcast(x, y);
  edgeWatch(y);
}

/** A drop (or a cancel) closes a zone that the drag opened; a pinned one stays only if the cards went back into it. */
function closeAfterDrag(droppedInto: string | null) {
  stopDwell();
  const open = useUI.getState().openZone;
  if (open && !(open.pinned && open.id === droppedInto)) useUI.setState({ openZone: null });
}

export function cancelDrag() {
  edgeStop();
  closeAfterDrag(null);
  const d = useUI.getState().drag;
  if (d) broadcast(d.x, d.y, true);
  useUI.setState({ drag: null });
}

/** Destination zone id for a target. */
export function destZone(view: TableView, t: DropTarget): string | null {
  if (!t) return null;
  if (t.kind === 'seat') return `hand:${t.seat}`;
  return view.zones.some((z) => z.id === t.zone) ? t.zone : null;
}

/** Default face for a move: playing from my hand to a shared zone turns cards face up unless "face down" is on. */
export function defaultFace(view: TableView, from: string, to: string, faceDown: boolean): 'up' | 'down' | undefined {
  const src = view.zones.find((z) => z.id === from);
  const dst = view.zones.find((z) => z.id === to);
  if (!src || !dst) return undefined;
  if (dst.kind !== 'hand' && src.kind === 'hand' && src.seatId === view.me.seatId) return faceDown ? 'down' : 'up';
  if (dst.kind !== 'hand' && faceDown) return 'down';
  return undefined;
}

export async function moveCards(handles: string[], from: string, to: string, opts: { index?: number; pos?: { x: number; y: number }; face?: 'up' | 'down' } = {}) {
  const view = useTable.getState().view;
  if (!view || !handles.length) return;
  const face = opts.face ?? defaultFace(view, from, to, useUI.getState().faceDown);
  const action = { type: 'move' as const, cards: handles, to, ...(opts.index !== undefined ? { index: opts.index } : {}), ...(face ? { face } : {}), ...(opts.pos ? { pos: opts.pos } : {}) };
  useUI.getState().clear();
  useUI.getState().pushRecent(to);
  return useTable.getState().send(action, (v) => predictMove(v, handles, to, opts.index, face));
}

export async function endDrag(x: number, y: number) {
  edgeStop();
  const d = useUI.getState().drag;
  if (!d) return;
  const over = targetAt(x, y);
  broadcast(x, y, true);
  useUI.setState({ drag: null });
  closeAfterDrag(over?.kind === 'zone' ? over.zone : null);
  const view = useTable.getState().view;
  if (!view) return;
  const to = destZone(view, over);
  if (!to) return;
  let index = over?.kind === 'zone' ? over.index : undefined;
  if (to === d.fromZone && index !== undefined) {
    // reordering within a zone: index is relative to the list after removal
    const z = view.zones.find((zz) => zz.id === to)!;
    const before = z.cards.slice(0, index).filter((c) => d.handles.includes(c.h)).length;
    index -= before;
    const unchanged = z.cards.findIndex((c) => c.h === d.handles[0]) === index && d.handles.length === 1;
    if (unchanged) return;
  }
  if (to === d.fromZone && index === undefined && !(over?.kind === 'zone' && over.pos)) return;
  return moveCards(d.handles, d.fromZone, to, { index, pos: over?.kind === 'zone' ? over.pos : undefined });
}
