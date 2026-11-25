/**
 * scrub-loupe: the board's scrubbable zones as one strip in reading order (rows top to bottom, zones left to right).
 * A scrub that runs off the end of a zone carries on into the next entry, and off the end of a row into the next row.
 * Pure: the host reads the zones from the board and feeds this list.
 */
export interface StripZone {
  id: string;
  /** Row number, from 0, as laid out on the board. */
  row: number;
  /** Cards in the zone; empty zones are passed over. */
  count: number;
}

export interface StripEntry {
  id: string;
  /** 1-based row number among the rows that have something to scrub, and how many such rows there are. */
  row: number;
  rows: number;
}

export function buildStrip(zones: StripZone[]): StripEntry[] {
  const kept = zones.filter((z) => z.count > 0);
  const rowNos = [...new Set(kept.map((z) => z.row))].sort((a, b) => a - b);
  return kept.map((z) => ({ id: z.id, row: rowNos.indexOf(z.row) + 1, rows: rowNos.length }));
}

/** The entry after (dir 1) or before (dir -1) a zone, or null at either end of the strip. */
export function neighbour(strip: StripEntry[], id: string, dir: 1 | -1): StripEntry | null {
  const i = strip.findIndex((e) => e.id === id);
  if (i < 0) return null;
  return strip[i + dir] ?? null;
}

/** "Row 2 of 3 · Discard" (the row part is left out when there is only one row). */
export function stripLabel(e: StripEntry, name: string): string {
  return e.rows > 1 ? `Row ${e.row} of ${e.rows} · ${name}` : name;
}

/**
 * header-scrub: which zone's header is under a finger at x, among the zones of one row (left to right).
 * A finger beside the row, or over a gap, picks the nearest zone.
 */
export function zoneAtX(zones: { id: string; left: number; right: number }[], x: number): string | null {
  if (zones.length === 0) return null;
  let best = zones[0];
  let bestD = Infinity;
  for (const z of zones) {
    const d = x < z.left ? z.left - x : x > z.right ? x - z.right : 0;
    if (d < bestD) {
      best = z;
      bestD = d;
    }
  }
  return best.id;
}

/** The finger counts as pushing against a side of the screen within this many px of it. */
export const EDGE_PX = 14;
/** Pushing for this long steps to the next row (and again every period while it keeps pushing). */
export const EDGE_MS = 350;

/** Which way a finger at x on a screen `width` wide is pushing: -1 left edge, 1 right edge, 0 neither. */
export function edgePush(x: number, width: number): -1 | 0 | 1 {
  if (x >= width - EDGE_PX) return 1;
  if (x <= EDGE_PX) return -1;
  return 0;
}

/** Step the push timer: returns the row step (-1, 0, 1) due now and the new timer state. */
export function edgeStep(state: { dir: -1 | 0 | 1; since: number }, dir: -1 | 0 | 1, now: number): { step: -1 | 0 | 1; state: { dir: -1 | 0 | 1; since: number } } {
  if (dir === 0) return { step: 0, state: { dir: 0, since: now } };
  if (state.dir !== dir) return { step: 0, state: { dir, since: now } };
  if (now - state.since >= EDGE_MS) return { step: dir, state: { dir, since: now } };
  return { step: 0, state };
}
