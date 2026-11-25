import { buildStrip, neighbour, stripLabel, type StripEntry } from './strip';

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

export function registerStrip(id: string, h: StripHandle) {
  handles.set(id, h);
  return () => {
    if (handles.get(id) === h) handles.delete(id);
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
      const h = handles.get(this.cur);
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
      const nh = handles.get(next.id);
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
    const h = handles.get(this.cur);
    this.away = this.cur !== this.origin || this.shift !== 0;
    if (!h || !this.away) return false;
    const r = h.el.getBoundingClientRect();
    h.show(h.indexAt(clientX + this.shift - r.left));
    return true;
  }

  label(): string | null {
    const e = this.entry();
    const h = handles.get(this.cur);
    return e && h && e.rows > 1 ? stripLabel(e, h.name) : null;
  }
}
