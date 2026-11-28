## Context

Scrubbing a pile follows the finger's travel with a speed-dependent gain (`RelativeScrub`), starting on the top card, and the fan is drawn by a row inside the pile's zone, which widens to give room. At ordinary speeds a card takes about 12 px, so a 52-card pile needs more travel than the screen is wide, and the shown card is not where the finger is. Hands and spreads scrub by position. A fisheye that follows the finger cannot make aiming more precise, because the focus point always maps to its own position in the undistorted layout; a lens helps only if it stays pinned while the finger moves inside it.

## Goals / Non-Goals

**Goals:** scrub the whole pile in one slide however big; the card under the finger is the card shown; precise aiming wherever the finger rests.
**Non-Goals:** changing the drop-slot (travel-based, works as is), hands, spreads or columns; a vertical fine-adjust gear; a setting.

## Decisions

- **Position, over the whole board.** The fan is an overlay across the full width of the board (the board's content box), at the pile's height, with the top card at the left end and the last card at the right end. The zone no longer widens for a scrub, because the fan no longer lives inside it. The loupe starts on the card under the finger, since the finger selects the card.
- **A piecewise-linear lens.** A pure `scrubLens(n, left, width, pin)` maps a screen x to a card index and back. It has four breakpoints: the left end maps to card 0, the lens start to the card k before the pinned card, the lens end to the card k after it, and the right end to the last card. Inside the lens each card has a slot of about 15 px (about six cards across); outside, the remaining cards share the remaining width equally. The mapping is monotonic and continuous.
- **Pinning.** The lens is pinned at the press point, on the card the uniform layout puts under it. When the finger rests for the gesture's dwell time (300 ms), the lens is pinned again at the finger's x on the card then shown, so the finger still maps to the same card and only the surroundings change. Between rests the mapping is fixed, so the same finger position always gives the same card.
- **Limits.** No slot is narrower than 2 px: if the outside slots would be narrower, the lens shrinks (fewer cards, same slot width) until they fit. Lens breakpoints are clamped inside the board, and a lens at an end simply has no compressed side there.
- **Room for the last card.** A card is drawn from the start of its slot and is a full card wide, so the mapping spans the board less the card width (plus a few px), and a finger past the end of the span is on the last card. The last card is then fully on the board, and the fan overlay is as wide as the board.
- **Drawing.** The overlay draws each card at its slot's start, in order, so the cards overlap like a spread; the card under the finger is raised and enlarged as the other fans do, which is the highlight. Slot positions come from the same mapping the finger uses, so what is drawn is what is aimed at.
- **Gesture wiring.** The pile's gesture keeps its `scrubAt` hook but feeds it the lens mapping instead of `RelativeScrub`; `onDwell` re-pins the lens (the loupe's details peek on a pause still happens). The drop slot keeps `RelativeScrub` and the speed gain.

## Risks / Trade-offs

- Compressed cards are narrow slivers; the loupe is how they are read.
- Pinning on rest means the mapping changes after a pause: the card under the finger is unchanged, but cards elsewhere move slightly.
- A pile too big for the width gets a smaller lens, so aiming is coarser for it.
