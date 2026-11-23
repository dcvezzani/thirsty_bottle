## ADDED Requirements

### Requirement: Per-player zones
A host SHALL be able to add a zone as "one per player". The table SHALL keep one copy of it for every seat, create a copy when a seat is added, and remove a seat's copy with the seat; a seat whose copies hold cards SHALL NOT be removed, as with its hand. Name, layout, width, new row and color SHALL be set once and apply to every copy. Removing the zone SHALL remove every copy, after their cards are moved.

#### Scenario: One definition, a copy per seat
- **WHEN** the host adds "Tableau" as one per player with Alex and Sam seated
- **THEN** Alex and Sam each have their own empty Tableau

#### Scenario: Later seats get a copy
- **WHEN** Kim takes a newly added seat at a table with a per-player "Tableau"
- **THEN** Kim has their own empty Tableau

#### Scenario: Edit once
- **WHEN** the host changes the per-player Tableau's layout to column
- **THEN** every player's Tableau uses the column layout

### Requirement: Per-player zone placement
A per-player zone SHALL take one slot in the shared zone order. Each seated player SHALL see their own copy in that slot, labelled as theirs, and SHALL NOT see other players' copies on their board. Arranging SHALL move the zone for everyone. Spectators SHALL see no copy on the board.

#### Scenario: Same slot, own cards
- **WHEN** the per-player Tableau sits between Stock and Discard
- **THEN** Alex sees their Tableau there and Sam sees their own Tableau in the same place

### Requirement: Per-player zone visibility
Cards in a per-player zone SHALL follow the ordinary face rules for every viewer, including its owner. Face-up cards SHALL be visible to all players and spectators, and SHALL be named in the log. Face-down cards SHALL be visible to no one unless shown or peeked, and the log SHALL NOT name them.

#### Scenario: Face-up cards are public
- **WHEN** Alex moves a face-up Queen of Hearts into their Tableau
- **THEN** Sam can see it in Alex's seat sheet, and the log says Alex moved the Queen of Hearts to their Tableau

#### Scenario: Face-down cards stay hidden, even from the owner
- **WHEN** a face-down card lies in Alex's Tableau
- **THEN** neither Alex nor Sam sees its face until it is flipped or peeked, and the log does not name it

### Requirement: Control of per-player zones
Per-player zones SHALL follow the hand rules for control. Only the owner SHALL flip, shuffle, peek, draw from or rearrange cards in their copy. Taking cards from another player's copy SHALL need that player's consent, unless open hands is on. Any player SHALL be able to pass cards into another player's copy.

#### Scenario: Taking asks first
- **WHEN** Sam tries to take a card from Alex's Tableau with open hands off
- **THEN** Alex is asked to allow it, and the card moves only if Alex accepts

#### Scenario: Passing in
- **WHEN** Sam passes a card to Alex's Tableau
- **THEN** the card is in Alex's Tableau

#### Scenario: Others cannot flip
- **WHEN** Sam tries to flip a card in Alex's Tableau
- **THEN** the action is refused

### Requirement: Seeing other players' per-player zones
Each copy SHALL show its card count on its owner's board. The seat bar SHALL show the count of each of a player's per-player zones. A seat's sheet SHALL list that player's per-player zones with their cards: face-up cards visible, face-down cards as backs. It SHALL offer the actions the viewer may take there: ask to take, take when open hands is on, and pass cards in.

#### Scenario: Counts in the seat bar
- **WHEN** Alex's Tableau holds 3 cards
- **THEN** Sam's seat bar shows Alex with Tableau 3

#### Scenario: Seat sheet shows face-up cards
- **WHEN** Sam opens Alex's seat sheet while Alex's Tableau holds a face-up King and a face-down card
- **THEN** the sheet shows the King's face and one card back under Tableau
