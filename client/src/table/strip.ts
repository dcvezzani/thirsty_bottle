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
