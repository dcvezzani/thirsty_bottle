## Context

The client already holds every zone's view (`view.zones`, each with its cards as the viewer sees them), the seats, the counters and the notes, so the Overview needs no new data except one thing. For a card in someone else's hand, the view says `known` when the viewer can see the face, but it cannot say whether the card was shown to everyone or only to the viewer: `shownTo` is sent only to the holder and shower, `shownBy` to a recipient. A peeked card is `known` too. The Overview must show only the public ones.

## Goals / Non-Goals

**Goals:** one scrolling page that shows the whole public table, reusing the existing card strip, loupe and card info sheet.
**Non-Goals:** editing from the Overview; a zoomed-out board; per-card history; showing cards only the viewer can see.

## Decisions

- **A `public` flag on card views.** The projection sets `public: true` on a card exactly when `isPublic(card, zone)` is true (a face-up card outside a hand, or a card shown to `'*'`), and omits it otherwise. The client shows a face only when the card is `public && known`, and a back otherwise, so peeked and privately shown cards stay hidden. The flag leaks nothing: it is true only for cards every participant can already see.
- **A full-screen page, not a route.** The Overview is a UI state (`overview: boolean` in the table UI store) that renders a full-screen layer over the table, so closing it returns to the unchanged table, selection and scroll. It is not rendered while a handoff cover is up.
- **Content comes from the view.** Sections are derived in a pure function `overviewSections(view)` returning the turn marker, shared zones in `boardSlots` order, each seated player with their per-player zones (all seats, not only the viewed one) and public hand cards, counters and notes. The component only renders it, which keeps the rules testable.
- **Compact strips.** Spreads, columns and free zones render as one wrapping strip of small cards; a pile renders its top card and the count. The strip reuses the existing card face and the loupe's scrub (read-only: no drag, select or flip handlers).
- **Live.** The layer reads the live view, so it updates as patches arrive.
- **Spectators.** The layer needs no seat, so it works for spectators.

## Risks / Trade-offs

- A long table makes a long page; sections have headers and a jump back to the top is the browser's scroll.
- Per-player zones multiply with seats; strips wrap, so the page grows vertically but stays within the width.
- The projection change touches every card view, so it needs tests that the flag never appears for hidden cards.
