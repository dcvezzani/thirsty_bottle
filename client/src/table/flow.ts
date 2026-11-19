/**
 * Board flow (zone-arrangement): wraps the shared zone order into rows that fit the board, honoring
 * each zone's width (fit / half / full) and "start a new row", and shrinks the cards of a row of
 * fit-width zones that would not otherwise fit, down to MIN_CARD_W. Pure.
 */
import type { ZoneLayout, ZoneWidth } from '@vct/shared';

export const MIN_CARD_W = 40;
export const GAP = 4;
/** Horizontal space a fit-width zone uses besides its cards (padding + borders). */
export const FIT_CHROME = 8;

export interface FlowZone {
  id: string;
  layout: ZoneLayout;
  width: ZoneWidth;
  newRow: boolean;
}

export interface FlowItem {
  id: string;
  /** Outer width in px. */
  w: number;
  /** Card width for this zone's cards. */
  cardW: number;
  width: ZoneWidth;
}

/** Width of a fit zone's card area for a given card width. */
function fitInner(layout: ZoneLayout, cardW: number): number {
  if (layout === 'pile') return cardW + 8; // the pile's stacked-edge offset
  if (layout === 'column') return cardW;
  return cardW * 3; // a spread or free zone set to "fit": room for a few cards
}
const fitOuter = (layout: ZoneLayout, cardW: number) => fitInner(layout, cardW) + FIT_CHROME;

export function flowRows(zones: FlowZone[], boardW: number, baseCardW: number): FlowItem[][] {
  const half = Math.floor((boardW - GAP) / 2);
  const rows: FlowZone[][] = [];
  let cur: FlowZone[] | null = null;
  const minRowW = (row: FlowZone[]) =>
    row.reduce((t, z) => t + (z.width === 'half' ? half : fitOuter(z.layout, MIN_CARD_W)), 0) + GAP * (row.length - 1);
  for (const z of zones) {
    if (z.width === 'full') {
      rows.push([z]);
      cur = null;
      continue;
    }
    if (!cur || z.newRow || minRowW([...cur, z]) > boardW) {
      cur = [z];
      rows.push(cur);
    } else cur.push(z);
  }
  return rows.map((row) => sizeRow(row, boardW, baseCardW, half));
}

function sizeRow(row: FlowZone[], boardW: number, baseCardW: number, half: number): FlowItem[] {
  if (row.length === 1 && row[0].width === 'full') return [{ id: row[0].id, w: boardW, cardW: baseCardW, width: 'full' }];
  const fits = row.filter((z) => z.width === 'fit');
  const fixed = row.length - fits.length;
  // card width that makes the fit zones fill what is left after half zones and gaps
  const avail = boardW - fixed * half - GAP * (row.length - 1);
  const perCard = fits.reduce((t, z) => t + fitInner(z.layout, 1) - fitInner(z.layout, 0), 0); // inner width per px of card width
  const extra = fits.reduce((t, z) => t + (fitInner(z.layout, 0) + FIT_CHROME), 0);
  const fitCardW = fits.length ? Math.max(MIN_CARD_W, Math.min(baseCardW, (avail - extra) / perCard)) : baseCardW;
  return row.map((z) =>
    z.width === 'half'
      ? { id: z.id, w: half, cardW: baseCardW, width: 'half' as const }
      : { id: z.id, w: Math.floor(fitOuter(z.layout, fitCardW)), cardW: Math.floor(fitCardW * 10) / 10, width: 'fit' as const },
  );
}
