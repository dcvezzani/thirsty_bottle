/**
 * header-scrub: the card that stands for a zone while its header is being scrubbed. A pile shows its top card,
 * a column its last card (the one fully visible), and any other zone its first card. An empty zone has none.
 */
export function zoneFocusCard<C>(zone: { layout: string; cards: C[] }): C | undefined {
  if (zone.cards.length === 0) return undefined;
  return zone.layout === 'column' ? zone.cards[zone.cards.length - 1] : zone.cards[0];
}
