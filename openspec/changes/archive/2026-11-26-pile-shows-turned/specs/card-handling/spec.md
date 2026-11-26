## REMOVED Requirements

### Requirement: Room follows the rotations
**Reason**: A pile now draws differently turned cards beneath its top card, so the room it reserves follows what it draws, not only the top card.
**Migration**: See "Room follows the rotations of drawn cards" and "Piles show turned cards beneath".

## ADDED Requirements

### Requirement: Room follows the rotations of drawn cards
The room a zone reserves SHALL follow the cards currently drawn in it and SHALL go away when they are upright again or gathered. A pile SHALL count the cards it draws: its top card and the differently turned cards drawn beneath it. Card slots, fan spacing and tap areas SHALL NOT change.

#### Scenario: Back to upright
- **WHEN** the only rotated card in a spread is set upright
- **THEN** the spread returns to the size it had before

#### Scenario: A pile counts what it draws
- **WHEN** an upright pile gets a card rotated 45° under its top card
- **THEN** the pile grows to hold that card, and returns to its size when the card is made upright

#### Scenario: Overlap
- **WHEN** a card rotated 45° sits among overlapping cards in a fan
- **THEN** it overlaps its neighbours like any other fanned card, and taps on its slot reach it

### Requirement: Piles show turned cards beneath
Beneath its top card a pile SHALL draw the first card of each outline that no card drawn above it has, as the card really is (face up, or its back, with its rotation), so that a card turned differently sticks out and can be seen. A card's outline is its rotation modulo 180°, so a pile draws at most three cards beneath the top. The cards beneath SHALL NOT be tappable, draggable or counted as cards in the zone, and the generic edge slivers SHALL stay.

#### Scenario: A differently turned card under three alike
- **WHEN** a pile holds, from the top, three upright cards and then a card rotated 90°
- **THEN** the rotated card is drawn beneath the top card, sticking out at its sides

#### Scenario: A turned top card over an upright one
- **WHEN** the top card of a pile is rotated 90° and the card under it is face up and upright
- **THEN** the upright card is drawn beneath, and the parts of it above and below the top card show its real face

#### Scenario: The same outline is not drawn
- **WHEN** the top card is upright and the card under it is upside down
- **THEN** no extra card is drawn beneath, because it would be completely covered

#### Scenario: Only three are drawn
- **WHEN** a pile holds cards rotated 0°, 45°, 90° and 135° from the top
- **THEN** all four are drawn, and no further card is drawn however many more are in the pile

#### Scenario: Only the top card acts
- **WHEN** a player taps or drags the part of a card drawn beneath the top card
- **THEN** the pile's own action runs, exactly as for a tap on the top card
