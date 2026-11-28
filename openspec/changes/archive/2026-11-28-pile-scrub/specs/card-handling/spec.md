## ADDED Requirements

### Requirement: Scrub a pile in place
A sideways slide on a pile SHALL fan the pile out into a spread in place and scrub through every card with the loupe, top card first. The card shown SHALL follow how far the finger has travelled, not where it is: slow movement steps card by card and fast movement covers the pile, so that any card can be reached. The pile SHALL collapse when the finger lifts, unless the player's Card loupe preference is "Stay open". Scrubbing SHALL NOT change the cards, their order or their faces for anyone.

#### Scenario: Slide across a pile
- **WHEN** a player slides sideways across a pile of 30 cards
- **THEN** the pile fans out in place, each card in turn appears in the loupe, and on release the pile collapses with its order and faces unchanged

#### Scenario: Slow movement steps card by card
- **WHEN** a player slides slowly across a pile of 52 cards
- **THEN** the loupe moves about one card for every 12 px of finger travel, so any single card can be reached

#### Scenario: A fast sweep covers the pile
- **WHEN** a player sweeps quickly across the width of the screen over a pile of 52 cards
- **THEN** the scrub passes through the whole pile, and slowing down at the end lets the player settle on a card exactly

#### Scenario: Pull still takes the top card
- **WHEN** a player pulls up or out from a pile instead of sliding sideways
- **THEN** the top card is picked up for dragging, as before; a sideways drag of an unselected pile is a scrub, so a card is taken to a neighbouring zone by pulling up first

#### Scenario: A selected pile still carries its selection
- **WHEN** a pile whose cards are selected is dragged sideways toward another zone
- **THEN** the selected cards are carried, as before, instead of scrubbing

#### Scenario: Other gestures unchanged
- **WHEN** a player taps, double-taps or holds on a pile
- **THEN** the pile's action sheet opens, the top card flips, or the top card's info opens, as before

### Requirement: See face-down cards while scrubbing a pile
While scrubbing a pile that has cards the player cannot see, the loupe SHALL offer a "See face-down" chip. A second finger tapping the chip SHALL toggle it during the scrub, and in stay-open mode a button in the loupe's controls SHALL toggle it. It SHALL be off at the start of every scrub. Turning it on SHALL peek at every card of the pile for that player, logging one peek line for everyone. Turning it off, or ending the scrub, SHALL clear that peek for those cards.

#### Scenario: Look through a face-down deck
- **WHEN** a player scrubs a face-down pile and a second finger taps "See face-down"
- **THEN** the loupe shows the faces of the cards as the scrub passes them, and the log shows one line that the player peeked at the pile's cards

#### Scenario: Chip off by default
- **WHEN** a player starts a new scrub on a pile after using the chip in an earlier one
- **THEN** the chip is off and face-down cards show their backs

#### Scenario: Peek ends with the scrub
- **WHEN** the scrub ends while the chip is on
- **THEN** the player's peek at those cards is cleared and the cards are face-down for them again

#### Scenario: No chip where it cannot work
- **WHEN** the pile has no cards the player cannot see, or the player is a spectator, or the pile is another player's own
- **THEN** the loupe shows no "See face-down" chip

## MODIFIED Requirements

### Requirement: Fan out a pile for scrubbing
A player SHALL be able to temporarily fan out any pile to scrub through it, then collapse it again, either from the pile's action sheet or by sliding sideways across the pile. Fanning out SHALL NOT change card order or face state, and hidden cards SHALL show only their backs unless the player has turned on "See face-down".

#### Scenario: Browse the discard pile
- **WHEN** a player fans out a face-up discard pile of 15 cards and scrubs through it
- **THEN** they can preview every card, and on collapse the pile is unchanged for all participants
