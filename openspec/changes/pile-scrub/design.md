## Context

A pile draws only its top card, and its press handler treats every drag as "take the top card"; sideways movement has no scrub. Spreads, columns and the hand already classify a press by its first movement (sideways = scrub with the loupe, away from the zone = pick up) in `ZoneGesture`, and a zone can open in place (`openZone`) so its cards can be aimed at. The faces of face-down cards are never sent to the client; the existing `peek` action reveals chosen cards privately to the peeker (`peekedBy`), logs one line for everyone, and `unpeek` clears it. Peek is allowed out of turn and, for shared piles, by any seated player.

## Goals / Non-Goals

**Goals:** browse a pile by sliding across it, and see face-down faces without leaving the scrub.
**Non-Goals:** a saved preference for the chip; scrubbing in hands, spreads or columns differently; new server actions.

## Decisions

- **Pile gesture.** The pile's `ZoneGesture` gains scrub: a first movement that is mostly sideways starts a scrub, and one that is mostly vertical or away keeps today's "take the top card" drag. The classification reuses the spread's thresholds so a pile and a spread feel the same. A pile whose cards are selected keeps the old behavior (any drag carries the selection), so "Moving a whole pile" is unchanged; and positions are measured against where the pile was when the press began, because the zone widens and collapses around the pile during a scrub.
- **Fan in place.** A pile scrub sets `openZone` for the pile and renders the pile as a spread of its cards (the same row used by "Fan out"), so the whole pile can be aimed at; it clears on release, or is kept by stay-open mode like any viewed card.
- **Order.** Index 0 is the top of a pile, so the spread runs top card first, left to right, matching the fan-out sheet.
- **The chip.** A `faceDown` flag in the loupe state (off at the start of every scrub) drives a "See face-down" chip in the loupe. A second finger tapping the chip toggles it through the loupe's existing second-finger handling, with a button in the stay-open controls. The chip shows only when the pile has cards the viewer cannot see, the viewer is seated, and the pile is not another player's own.
- **Peek and un-peek.** Turning it on sends one `peek` for the pile's cards; the server's log line is the honest trail. The client remembers which cards it peeked at that were not already peeked by the player, and turning it off or ending the scrub sends `unpeek` for exactly those, so earlier peeks are untouched.
- **Faces in the loupe.** Once the peek patch arrives the cards are `known` for the viewer, so the loupe shows their faces with no further change.

## Risks / Trade-offs

- A deck-wide peek is visible in the log to everyone as a count: intentional, and it keeps looking through a deck honest.
- The peek and its patch take a round trip; the chip shows busy until the faces arrive.
- Cards moved during a peeking scrub get new handles; the cleanup un-peeks by card, not by position, and ignores cards that are gone.
