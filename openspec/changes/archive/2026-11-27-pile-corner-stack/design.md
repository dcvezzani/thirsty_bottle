# Design

## Context

- **Pile drawing today:** `Pile` (`Zones.tsx`) draws `depth` generic slivers, then each card `pileShown` picks beneath the top card as a decorative `CardFace`, then the top card. Every card is a `.card` at `left: 0; top: 0` of the pile's box (the slot, `cardW + 8` wide, `cardW · 1.4 + 8` high) and a rotated card turns about the slot's centre inside `.card-turn`.
- **Room:** `zonePad` reserves room on every side for the largest rotation drawn (a pile: the cards `pileShown` picks); the pile gets that as margins and a `::before` tap area, and the board flow widens a fit pile by `2 · padX · cardW`.

## Goals / Non-Goals

**Goals:** a pile with differently turned cards shows them as an L from a shared bottom-left corner.

**Non-Goals:** no change to which cards a pile draws, to columns, spreads, hands or free zones, or to what the cards beneath are (decoration).

## Decisions

**D1. The arrangement (pure).**
- The outline of a card turned by `r` steps, as a box for a card of width 1 and height 1.4: `W = |cos| + 1.4·|sin|`, `H = |sin| + 1.4·|cos|`.
- `pileCorner(rots)` takes the rotations of the cards the pile draws (the top card first, as `pileShown` returns them) and returns `{ corner, right, top, place }`:
  - `corner` is true when the drawn cards have more than one outline (`rot mod 4`); only then are they aligned. Otherwise the pile is as before.
  - `right = max(0, maxW − 1)` and `top = max(0, maxH − 1.4)`, as fractions of the card width: the room to the right and above.
  - `place(r)` is the offset of a card turned by `r` from where an upright card sits, as fractions of the card width: `dx = W/2 − 0.5` and `dy = 0.7 − H/2` (CSS y grows downwards). It puts the card's box with its bottom-left corner at the slot's bottom-left corner. It is `(0, 0)` for 0° and 180°.
- The pile's room for the flow is `{ x: right / 2, y: top / 2 }` in `zonePad`'s symmetric form (the flow doubles `x`), which gives the right amount of extra width.

**D2. Drawing.**
- `CardFace` gets an optional `shift` (a translation in px) applied in the card's turn transform: `translate(dx, dy) rotate(r · 45deg)`, so the card's centre moves and it then turns about its own centre. An upright card has no turn element and needs no shift.
- `Pile` computes `pileCorner` from the cards it draws and, when `corner` is true, passes each drawn card (top and beneath) its `place(rot) · cardW` as `shift`; the margins become `top` above and `right` to the right only (none below or to the left), and the tap-area `::before` extends the same way (separate right, top, left, bottom custom properties replace the symmetric pair).
- When `corner` is false the pile is drawn exactly as now, with the symmetric room for a single rotated card.

**D3. Tests.** `pileCorner` over: upright over a 90° card (right room 0.4, top 0); upright over a 45° card (right 0.7, top 0.3); a 90° top over an upright card (room 0.4 on the right, since the landscape card is wider than the slot, and none above); one outline only (corner false); 180° beneath upright (not drawn, so not a mix); offsets of each rotation; the pile's flow room. E2E: a mixed pile's drawn cards share their bottom-left corner (the left edges and bottoms of their boxes agree), a diagonal card's box sticks out above and to the right, the pile's box grows to the right and above and not below or to the left, a pile with one outline is centred as before, and a tap on the L opens the pile's actions.

## Risks / Trade-offs

- **The top card jumps** to the corner when a differently turned card first shows beneath it, and back when the mix ends. It is a single, explained change of place.
- **Asymmetric room** needs the pile's margins and tap area to be per side, and the flow's width to follow the one-sided room.
