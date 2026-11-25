# Proposal

## Why

The scrub-loupe change lets a scrub slide from one spread into the next, but it cannot cover columns or piles: in a column a sideways slide picks up a run of cards, so sliding sideways cannot also mean "go to the next zone". Piles have no cards to slide along. Many zones are also tiny on a phone, so reaching a particular one with a finger is hard. The zone headers are a free place for this: today they only open the zone's actions on a tap, or start arrange mode on a still hold for the host.

## What Changes

- **Scrub along the headers.** Pressing a zone header and sliding sideways travels from zone to zone in reading order, wrapping to the next row, across every kind of zone (piles, spreads, columns, free zones). Empty zones are passed over.
- **The loupe follows.** On each zone the loupe shows its most relevant card (a pile's top card, a column's last card, a spread's or free zone's first card) with the zone's name, count and row. A pause shows that card's full details. The device ticks at each crossing and releasing changes nothing.
- **Into the cards.** Sliding down from a header into the zone's cards starts that zone's normal scrub (sideways for a row, vertical for a column) in the same stroke, with the pointer handed to the zone.
- **Header gestures stay.** A tap still opens the zone's actions and the host's still hold still starts arrange mode; a slide cancels both.
- **A bigger press area.** A header can be pressed from a margin above and below it, so the thin header is easy to hit.
- **Unchanged.** Sliding past the end of a spread into the next one still works as in scrub-loupe; columns and piles do not hand over from their card area.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `card-handling`: new requirements "Scrub along zone headers", "Header scrub enters the cards" and "Zone header press area". The existing requirements stay as they are.

## Impact

- **Client only.** A header gesture on each zone's label, a header strip over every zone kind that reuses the scrub-loupe strip run, a hand-off into the zone's card gesture, and a larger press area. No server, shared-rules or protocol change.
- **Tests:** unit tests for the header gesture and the zone's focus card; e2e for sliding along headers (wrapping rows, across a pile and a column), for entering the cards, and for tap and still hold still working; contrast for the loupe in header scrub.
