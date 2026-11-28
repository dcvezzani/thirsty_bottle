## MODIFIED Requirements

### Requirement: Scrub a pile in place
A sideways slide on a pile SHALL fan the pile out in place across the full width of the board and scrub through every card with the loupe, the top card at the left end and the last card at the right end. The card shown SHALL be the one under the finger, highlighted in the fan, so the whole pile can be scrubbed in one slide however big it is. The pile SHALL collapse when the finger lifts, unless the player's Card loupe preference is "Stay open". Scrubbing SHALL NOT change the cards, their order or their faces for anyone.

#### Scenario: Slide across a pile
- **WHEN** a player slides sideways across a pile of 30 cards
- **THEN** the pile fans out across the board, each card in turn appears in the loupe as the finger passes it, and on release the pile collapses with its order and faces unchanged

#### Scenario: Slow movement steps card by card
- **WHEN** a player moves the finger within the lens of a pile of 52 cards
- **THEN** each step of about 15 px moves the loupe by one card, so any single card can be chosen

#### Scenario: A fast sweep covers the pile
- **WHEN** a player slides across the width of the board over a pile of 52 cards
- **THEN** the loupe passes through the whole pile, from the first card at the left end to the last card at the right end

#### Scenario: Pull still takes the top card
- **WHEN** a player pulls up or out from a pile instead of sliding sideways
- **THEN** the top card is picked up for dragging, as before; a sideways drag of an unselected pile is a scrub, so a card is taken to a neighbouring zone by pulling up first

#### Scenario: A selected pile still carries its selection
- **WHEN** a pile whose cards are selected is dragged sideways toward another zone
- **THEN** the selected cards are carried, as before, instead of scrubbing

#### Scenario: Other gestures unchanged
- **WHEN** a player taps, double-taps or holds on a pile
- **THEN** the pile's action sheet opens, the top card flips, or the top card's info opens, as before

## ADDED Requirements

### Requirement: A lens refines a pile scrub
While a pile is scrubbed, the cards around a pinned point SHALL have wide slots, about 15 px each and about six cards across, and the other cards SHALL be compressed so the whole pile still spans the board. The lens SHALL be pinned where the finger presses and pinned again where the finger rests for about 300 ms. No slot SHALL be narrower than 2 px, so a pile too big for the width gets a smaller lens.

#### Scenario: Fine-tune inside the lens
- **WHEN** a player presses on a pile and moves the finger a short way
- **THEN** each step of about 15 px near where it pressed moves the loupe by one card

#### Scenario: Rest to re-pin
- **WHEN** a player slides to the far end of the pile and rests the finger for 300 ms
- **THEN** the lens settles under the finger and further small movements step one card at a time there

#### Scenario: A very large pile
- **WHEN** a pile has more cards than the board can show at 2 px each outside a full lens
- **THEN** the lens is smaller and no card is narrower than 2 px
