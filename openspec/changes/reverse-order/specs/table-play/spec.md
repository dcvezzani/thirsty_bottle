## ADDED Requirements

### Requirement: Moved cards keep their order
Moving several cards in one action SHALL keep their order in the list they came from, wherever they go: the first card moved onto a pile lands on top of it, and cards moved onto a spread, a hand or a column keep their left-to-right or top-to-bottom order. A pile layers its cards with the first on top and the other zones layer them with the last on top, so a group moved between a pile and another zone shows its stack the other way round; Reverse order is the way to get the opposite stacking.

#### Scenario: A hand onto a pile
- **WHEN** a hand holds, from left to right, A, B, C and D and a player moves all four onto the Discard pile
- **THEN** the pile reads A, B, C, D from top to bottom, and A shows on top

#### Scenario: A pile onto a spread
- **WHEN** a player moves a pile that reads P, Q, R from top to bottom onto a spread
- **THEN** the spread reads P, Q, R from left to right

#### Scenario: Reverse first for the other stacking
- **WHEN** a player reverses the order of a hand A, B, C, D and then moves all four onto a pile
- **THEN** the pile reads D, C, B, A from top to bottom, and D, the card that nothing covered in the hand, shows on top

### Requirement: Reversing card order
Any participant who may flip a card SHALL be able to reverse the order of the selected cards in their zone, or of every card in a zone, in one action. Reversing the selected cards SHALL exchange the cards among the places they occupy, leaving the other cards where they are. Reversing SHALL NOT change any card's face or rotation, SHALL be logged, SHALL be undoable like flipping, and SHALL be refused for another player's zone when hands are not open. Reversing fewer than two cards does nothing.

#### Scenario: Reverse some cards of a spread
- **WHEN** a spread reads A, B, C, D, E and a player reverses the selected B and D
- **THEN** the spread reads A, D, C, B, E

#### Scenario: Reverse a whole hand
- **WHEN** a player selects every card of a hand A, B, C, D and reverses their order
- **THEN** the hand reads D, C, B, A

#### Scenario: Reverse a pile without turning it over
- **WHEN** a player reverses a face-down pile that reads P, Q, R from top to bottom
- **THEN** the pile reads R, Q, P and every card is still face down

#### Scenario: Another player's zone
- **WHEN** a player tries to reverse cards in another player's hand while hands are not open
- **THEN** nothing changes and the player is told it is not their zone

#### Scenario: Undo
- **WHEN** a player reverses a hand and then undoes it
- **THEN** the hand reads as it did before
