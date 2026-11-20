## MODIFIED Requirements

### Requirement: Card face state
Every card instance SHALL be either face up or face down at all times. Any permitted participant SHALL be able to flip a card, or every card in a zone at once. Flipping every card in a pile SHALL turn the pile over: the order reverses so the bottom card becomes the top, and each card's face toggles. In any other layout, flipping every card SHALL turn them all the same way in place.

#### Scenario: Flip a card face up
- **WHEN** a player flips a face-down card in a shared spread
- **THEN** every participant sees that card's front

#### Scenario: Turn over a face-down deck
- **WHEN** a player flips every card in a face-down pile whose cards from top to bottom are A, B, C, D
- **THEN** the pile reads D, C, B, A from top to bottom, all face up, and D shows on top

#### Scenario: Turn over a mixed pile
- **WHEN** a player flips every card in a pile whose cards from top to bottom are A (down), B (down), C (up)
- **THEN** the pile reads C (down), B (up), A (up) from top to bottom

#### Scenario: Flip every card in a spread
- **WHEN** a player flips every card in a face-down spread of A, B, C
- **THEN** the spread still reads A, B, C, now all face up

#### Scenario: Undo a turn-over
- **WHEN** a player turns a pile over and presses undo within 10 seconds, before anyone else acts
- **THEN** the pile returns to its previous order and faces
