## ADDED Requirements

### Requirement: Stacking cards onto a pile
When several cards from one hand, spread, column or free zone are moved onto a pile in one action, the card that is on top of the others in the source SHALL land on top of the pile, and the others SHALL follow in the order they were layered. The order SHALL follow the cards' places in the source, not the order they were chosen in. Cards moved from a pile keep their order, and one card is unaffected.

#### Scenario: A fanned hand onto a pile
- **WHEN** a hand holds, from left to right, the cards A, B, C and D (D is uncovered) and a player moves all four onto the Discard pile
- **THEN** the pile reads D, C, B, A from top to bottom, and D shows on top

#### Scenario: Cards from a spread
- **WHEN** a player moves the 2nd, 3rd and 4th cards of a spread onto a pile
- **THEN** the 4th card lands on top of the pile, above the 3rd and then the 2nd

#### Scenario: A run from a column
- **WHEN** a player moves the 3rd, 4th and 5th cards of a column onto a pile
- **THEN** the 5th card, the fully visible one, lands on top

#### Scenario: Chosen in another order
- **WHEN** a player selects the last card of a spread first and the first card second and moves them onto a pile
- **THEN** the last card is on top, because it was on top in the spread

#### Scenario: A pile moved onto a pile
- **WHEN** a player moves a whole pile onto another pile
- **THEN** the moved cards keep their order and land on top of it

#### Scenario: One card and other destinations
- **WHEN** a player moves one card onto a pile, or several cards onto a spread, a hand or a column
- **THEN** the result is the same as before this requirement
