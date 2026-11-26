## REMOVED Requirements

### Requirement: Rotated cards fit their slot
**Reason**: A rotated card should keep its size and the zone should make room for it, not the card shrink to fit the slot.
**Migration**: See "Rotated cards keep their size" and "Zones make room for rotated cards".

## ADDED Requirements

### Requirement: Rotated cards keep their size
A rotated card SHALL be drawn at its normal size, rotated about its centre, in every kind of zone, in hands and while carried, and SHALL NOT be scaled down. Tap areas SHALL NOT change with rotation.

#### Scenario: A rotated card in a spread
- **WHEN** a card rotated 45° is in a spread of 6 cards
- **THEN** it is drawn tilted at the same size as the other cards

#### Scenario: A carried card
- **WHEN** a player carries a card rotated 90°
- **THEN** the carried card is drawn rotated at its normal size

#### Scenario: Tapping a rotated card
- **WHEN** a player taps the middle of a rotated card
- **THEN** it is selected like any other card

### Requirement: Zones make room for rotated cards
A zone SHALL grow so that the cards in it, at their rotations, are not clipped: on each side it reserves the extra room that the most rotated card in it needs beyond an upright card. A spread or a hand becomes wider and taller around its fan, a column wider, a pile bigger, and a zone among fit-width zones wider, its row-mates shrinking or wrapping as they already do.

#### Scenario: A spread with a card turned 45°
- **WHEN** a card in a spread is rotated 45°
- **THEN** the spread grows taller and wider, and the whole card is visible inside it

#### Scenario: A column with a card turned 90°
- **WHEN** a card in a column is rotated 90°
- **THEN** the column is wider, and the card is not clipped

#### Scenario: A row of zones
- **WHEN** a card in a zone that shares a row with other fit-width zones is rotated 45°
- **THEN** that zone is wider, and the other zones in the row shrink or wrap to make room

### Requirement: Room follows the rotations
The room a zone reserves SHALL follow the cards currently in it and SHALL go away when they are upright again or gathered. A pile SHALL count only its top card, which is the card it shows. Card slots, fan spacing and tap areas SHALL NOT change.

#### Scenario: Back to upright
- **WHEN** the only rotated card in a spread is set upright
- **THEN** the spread returns to the size it had before

#### Scenario: A pile shows its top card
- **WHEN** a card rotated 45° is the second card of a pile
- **THEN** the pile is its usual size until that card is on top

#### Scenario: Overlap
- **WHEN** a card rotated 45° sits among overlapping cards in a fan
- **THEN** it overlaps its neighbours like any other fanned card, and taps on its slot reach it
