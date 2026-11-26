## MODIFIED Requirements

### Requirement: Piles show turned cards beneath
Beneath its top card a pile SHALL draw the first card of each outline that no card drawn above it has, as the card really is (face up, or its back, with its rotation), so that a card turned differently sticks out and can be seen. A card's outline is its rotation modulo 180°, so a pile draws at most three cards beneath the top. The cards beneath SHALL NOT be tappable, draggable or counted as cards in the zone, and the generic edge slivers SHALL stay.

#### Scenario: A differently turned card under three alike
- **WHEN** a pile holds, from the top, three upright cards and then a card rotated 90°
- **THEN** the rotated card is drawn beneath the top card, sticking out on its right

#### Scenario: A turned top card over an upright one
- **WHEN** the top card of a pile is rotated 90° and the card under it is face up and upright
- **THEN** the upright card is drawn beneath, and the part of it above the top card shows its real face

#### Scenario: The same outline is not drawn
- **WHEN** the top card is upright and the card under it is upside down
- **THEN** no extra card is drawn beneath, because it would be completely covered

#### Scenario: Only three are drawn
- **WHEN** a pile holds cards rotated 0°, 45°, 90° and 135° from the top
- **THEN** all four are drawn, and no further card is drawn however many more are in the pile

#### Scenario: Only the top card acts
- **WHEN** a player taps or drags the part of a card drawn beneath the top card
- **THEN** the pile's own action runs, exactly as for a tap on the top card

### Requirement: Room follows the rotations of drawn cards
The room a zone reserves SHALL follow the cards currently drawn in it and SHALL go away when they are upright again or gathered. A pile SHALL count the cards it draws: its top card and the differently turned cards drawn beneath it, and a pile with cards of more than one outline reserves room only to the right and above. Card slots, fan spacing and tap areas SHALL NOT change.

#### Scenario: Back to upright
- **WHEN** the only rotated card in a spread is set upright
- **THEN** the spread returns to the size it had before

#### Scenario: A pile counts what it draws
- **WHEN** an upright pile gets a card rotated 45° under its top card
- **THEN** the pile grows to hold that card, and returns to its size when the card is made upright

#### Scenario: Overlap
- **WHEN** a card rotated 45° sits among overlapping cards in a fan
- **THEN** it overlaps its neighbours like any other fanned card, and taps on its slot reach it

## ADDED Requirements

### Requirement: Mixed piles line up at the bottom-left corner
When a pile draws cards of more than one outline, the rotated outline of every drawn card, the top card included, SHALL be placed with its bottom-left corner at the bottom-left corner of the pile's slot, so that a larger outline sticks out along the top and the right and the exposed part forms an L. A pile whose drawn cards share one outline SHALL stay centred.

#### Scenario: A landscape card under an upright one
- **WHEN** the top card of a pile is upright and the card under it is rotated 90°
- **THEN** the two share their bottom-left corner and the rotated card sticks out only on the right

#### Scenario: A diagonal card under an upright one
- **WHEN** the top card of a pile is upright and the card under it is rotated 45°
- **THEN** the two share their bottom-left corner and the diagonal card sticks out along the top and the right, forming an L

#### Scenario: A turned top card
- **WHEN** the top card of a pile is rotated 90° over an upright card
- **THEN** the turned top card sits in the bottom-left corner of the pile and the upright card sticks out above it

#### Scenario: One outline stays centred
- **WHEN** every card a pile draws has the same outline
- **THEN** the pile looks as it did before, with its card centred

#### Scenario: Back to one outline
- **WHEN** the differently turned card of a mixed pile is made upright
- **THEN** the pile returns to being centred and to its normal size

### Requirement: Room for a mixed pile
The room a mixed pile reserves SHALL be to the right and above, as much as its largest outline needs, and none below or to the left; in a row of fit-width zones its zone is wider by that amount. The pile's tap area SHALL cover the whole of the drawn area.

#### Scenario: Room on two sides only
- **WHEN** a pile gets a card turned 45° under its upright top card
- **THEN** the pile's box grows to the right and above and does not grow below or to the left

#### Scenario: Tapping the L
- **WHEN** a player taps the part of a card that sticks out above or to the right of the top card
- **THEN** the pile's own action runs
