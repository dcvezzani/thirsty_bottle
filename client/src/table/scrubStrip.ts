import { buildStrip, edgePush, edgeStep, neighbour, stripLabel, zoneAtX, type StripEntry } from './strip';

/**
 * scrub-loupe: the board-level side of a scrub that crosses zones. Each scrubbable row registers a handle;
 * a scrub started in one zone asks the run below which zone and card are under the finger, and the run hands
 * over to the next zone in reading order (and to the next row) when the finger runs off the cards.
 */
export interface StripHandle {
  el: HTMLElement;
  name: string;
  /** Extent of the cards inside the element, in element-relative x. */
  extent(): { left: number; right: number };
  /** Card index nearest to element-relative x (never null while the zone has cards). */
  indexAt(x: number): number;
  /** Show card i (preview/loupe). `paint` is true while the scrub is in its own zone and painting a selection. */
  show(i: number): void;
}

const handles = new Map<string, StripHandle>();
/** header-scrub: every zone with cards, for a scrub that slides along the zone headers. */
const headerHandles = new Map<string, StripHandle>();
/** header-scrub: zones that can take a scrub from a header, at a client point (rows and columns). Returns false if it cannot. */
export const enterRegistry = new Map<string, (clientX: number, clientY: number, pointerId: number) => boolean>();

export function registerStrip(id: string, h: StripHandle) {
  handles.set(id, h);
  return () => {
    if (handles.get(id) === h) handles.delete(id);
  };
}

export function registerHeader(id: string, h: StripHandle) {
  headerHandles.set(id, h);
  return () => {
    if (headerHandles.get(id) === h) headerHandles.delete(id);
  };
}


const HYSTERESIS = 6;

export class StripRun {
  private strip: StripEntry[];
  private rowEl = new Map<string, Element | null>();
  cur: string;
  private shift = 0;
  /** True while the scrub is somewhere other than a plain slide over its own zone. */
  away = false;

  private reg = handles;

  constructor(private origin: string, private onCross: (entry: StripEntry, name: string) => void) {
    const zones: { id: string; row: number; count: number }[] = [];
    const rows = [...document.querySelectorAll('.board .zone-row')];
    rows.forEach((row, r) => {
      for (const el of row.querySelectorAll<HTMLElement>('[data-strip-zone]')) {
        const id = el.dataset.zoneId!;
        zones.push({ id, row: r, count: Number(el.dataset.count ?? 0) });
        this.rowEl.set(id, row);
      }
    });
    this.strip = buildStrip(zones);
    this.cur = origin;
  }

  get entries() {
    return this.strip.length;
  }

  entry(id = this.cur) {
    return this.strip.find((e) => e.id === id) ?? null;
  }

  /** Move the scrub for a finger at (clientX); returns false while the origin zone's own gesture is in charge. */
  update(clientX: number): boolean {
    for (let guard = 0; guard < 8; guard++) {
      const h = this.reg.get(this.cur);
      if (!h) break;
      const r = h.el.getBoundingClientRect();
      const ex = h.extent();
      const vx = clientX + this.shift;
      const localX = vx - r.left;
      let next: StripEntry | null = null;
      let dir: 1 | -1 = 1;
      if (localX > ex.right + HYSTERESIS) next = neighbour(this.strip, this.cur, 1);
      else if (localX < ex.left - HYSTERESIS) {
        next = neighbour(this.strip, this.cur, -1);
        dir = -1;
      }
      if (!next) break;
      const nh = this.reg.get(next.id);
      if (!nh) break;
      if (this.rowEl.get(next.id) !== this.rowEl.get(this.cur)) {
        // a new row: carry on from the first card (forwards) or the last card (backwards), wherever the finger is
        const nr = nh.el.getBoundingClientRect();
        const nx = nh.extent();
        this.shift = (dir === 1 ? nr.left + nx.left : nr.left + nx.right) - clientX;
        nh.el.scrollIntoView?.({ block: 'nearest' });
      }
      this.cur = next.id;
      this.onCross(next, nh.name);
    }
    const h = this.reg.get(this.cur);
    this.away = this.cur !== this.origin || this.shift !== 0;
    if (!h || !this.away) return false;
    const r = h.el.getBoundingClientRect();
    h.show(h.indexAt(clientX + this.shift - r.left));
    return true;
  }

  label(): string | null {
    const e = this.entry();
    const h = this.reg.get(this.cur);
    return e && h && e.rows > 1 ? stripLabel(e, h.name) : null;
  }
}

/**
 * header-scrub: a scrub along the zone headers. Within a row the finger picks the header under it; holding the finger against
 * the left or right edge of the screen steps to the next or previous row (and again while it keeps pushing), since a finger
 * that has reached the edge has nowhere further to slide. Rows with nothing to show are passed over.
 */
export class HeaderStripRun {
  private rows: string[][] = [];
  private rowIdx = 0;
  cur: string | null = null;
  private x = 0;
  private push: { dir: -1 | 0 | 1; since: number } = { dir: 0, since: 0 };

  constructor(origin: string, private onCross: () => void) {
    const domRows = [...document.querySelectorAll('.board .zone-row')];
    let originRow = -1;
    domRows.forEach((row) => {
      const ids = [...row.querySelectorAll<HTMLElement>('[data-header-zone]')]
        .filter((el) => Number(el.dataset.count ?? 0) > 0 && headerHandles.has(el.dataset.headerZone!))
        .map((el) => el.dataset.headerZone!);
      if (!ids.length) return;
      if (row.querySelector(`[data-header-zone="${CSS.escape(origin)}"]`)) originRow = this.rows.length;
      this.rows.push(ids);
    });
    this.rowIdx = Math.max(0, originRow);
    this.cur = this.rows[this.rowIdx]?.includes(origin) ? origin : (this.rows[this.rowIdx]?.[0] ?? null);
  }

  get entries() {
    return this.rows.flat().length;
  }

  /** Follow the finger at clientX; shows the zone under it. */
  update(clientX: number, now = performance.now()) {
    this.x = clientX;
    this.pick();
    this.edge(now);
  }

  /** Called on the clock while the finger is down, so pushing against the edge works without movement. */
  tick(now = performance.now()) {
    this.edge(now);
  }

  private pick() {
    const ids = this.rows[this.rowIdx] ?? [];
    const rects = ids.map((id) => {
      const r = headerHandles.get(id)!.el.getBoundingClientRect();
      return { id, left: r.left, right: r.right };
    });
    const id = zoneAtX(rects, this.x);
    if (id && id !== this.cur) {
      this.cur = id;
      this.onCross();
    }
    if (this.cur) headerHandles.get(this.cur)?.show(0);
  }

  private edge(now: number) {
    const r = edgeStep(this.push, edgePush(this.x, window.innerWidth), now);
    this.push = r.state;
    if (!r.step) return;
    const next = this.rowIdx + r.step;
    if (next < 0 || next >= this.rows.length) return;
    this.rowIdx = next;
    this.cur = null;
    this.pick();
    const el = this.cur ? headerHandles.get(this.cur)?.el : null;
    el?.scrollIntoView?.({ block: 'nearest' });
    this.onCross();
  }

  label(): string | null {
    const h = this.cur ? headerHandles.get(this.cur) : null;
    if (!h || !this.cur) return null;
    return stripLabel({ id: this.cur, row: this.rowIdx + 1, rows: this.rows.length }, h.name);
  }
}
