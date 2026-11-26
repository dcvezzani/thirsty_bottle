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
  /** card-rotation: room the rotated cards need on each side, as a fraction of the card width (0 or absent: none). */
  padX?: number;
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
function fitInner(layout: ZoneLayout, cardW: number, padX = 0): number {
  const room = 2 * padX * cardW;
  if (layout === 'pile') return cardW + 8 + room; // the pile's stacked-edge offset
  if (layout === 'column') return cardW + room;
  return cardW * 3 + room; // a spread or free zone set to "fit": room for a few cards
}
const fitOuter = (layout: ZoneLayout, cardW: number, padX = 0) => fitInner(layout, cardW, padX) + FIT_CHROME;

/** scrub-loupe: a zone opened wider so its cards can be aimed at; the rest of its row makes room. */
export function flowRows(zones: FlowZone[], boardW: number, baseCardW: number, openId?: string): FlowItem[][] {
  const half = Math.floor((boardW - GAP) / 2);
  const rows: FlowZone[][] = [];
  let cur: FlowZone[] | null = null;
  const minRowW = (row: FlowZone[]) =>
    row.reduce((t, z) => t + (z.width === 'half' ? half : fitOuter(z.layout, MIN_CARD_W, z.padX)), 0) + GAP * (row.length - 1);
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
  return rows.map((row) => (openId && row.some((z) => z.id === openId && z.width === 'fit') ? openRow(row, boardW, baseCardW, half, openId) : sizeRow(row, boardW, baseCardW, half)));
}

/** A row with one fit zone opened: it takes all the room the others do not need; fit neighbours shrink to the smallest cards. */
function openRow(row: FlowZone[], boardW: number, baseCardW: number, half: number, openId: string): FlowItem[] {
  const others = row.filter((z) => z.id !== openId && z.width === 'fit');
  const halves = row.filter((z) => z.width === 'half').length;
  const used = halves * half + others.reduce((t, z) => t + fitOuter(z.layout, MIN_CARD_W, z.padX), 0) + GAP * (row.length - 1);
  const natural = sizeRow(row, boardW, baseCardW, half).find((i) => i.id === openId)!;
  const w = Math.max(natural.w, boardW - used);
  return row.map((z) => {
    if (z.id === openId) return { id: z.id, w, cardW: baseCardW, width: 'fit' as const };
    if (z.width === 'half') return { id: z.id, w: half, cardW: baseCardW, width: 'half' as const };
    return { id: z.id, w: Math.floor(fitOuter(z.layout, MIN_CARD_W, z.padX)), cardW: MIN_CARD_W, width: 'fit' as const };
  });
}

function sizeRow(row: FlowZone[], boardW: number, baseCardW: number, half: number): FlowItem[] {
  if (row.length === 1 && row[0].width === 'full') return [{ id: row[0].id, w: boardW, cardW: baseCardW, width: 'full' }];
  const fits = row.filter((z) => z.width === 'fit');
  const fixed = row.length - fits.length;
  // card width that makes the fit zones fill what is left after half zones and gaps
  const avail = boardW - fixed * half - GAP * (row.length - 1);
  const perCard = fits.reduce((t, z) => t + fitInner(z.layout, 1, z.padX) - fitInner(z.layout, 0, z.padX), 0); // inner width per px of card width
  const extra = fits.reduce((t, z) => t + (fitInner(z.layout, 0, z.padX) + FIT_CHROME), 0);
  const fitCardW = fits.length ? Math.max(MIN_CARD_W, Math.min(baseCardW, (avail - extra) / perCard)) : baseCardW;
  return row.map((z) =>
    z.width === 'half'
      ? { id: z.id, w: half, cardW: baseCardW, width: 'half' as const }
      : { id: z.id, w: Math.floor(fitOuter(z.layout, fitCardW, z.padX)), cardW: Math.floor(fitCardW * 10) / 10, width: 'fit' as const },
  );
}

/** Arrange mode: tiles big enough for their controls, in the same order and with the same row rules. */
export const TILE_FIT_W = 108;
export function arrangeRows(zones: FlowZone[], boardW: number): FlowItem[][] {
  const half = Math.floor((boardW - GAP) / 2);
  const w = (z: FlowZone) => (z.width === 'full' ? boardW : z.width === 'half' ? half : Math.min(TILE_FIT_W, boardW));
  const rows: FlowItem[][] = [];
  let cur: FlowItem[] | null = null;
  let used = 0;
  for (const z of zones) {
    const item: FlowItem = { id: z.id, w: w(z), cardW: 0, width: z.width };
    if (z.width === 'full') {
      rows.push([item]);
      cur = null;
      continue;
    }
    if (!cur || z.newRow || used + GAP + item.w > boardW) {
      cur = [item];
      rows.push(cur);
      used = item.w;
    } else {
      cur.push(item);
      used += GAP + item.w;
    }
  }
  return rows;
}
