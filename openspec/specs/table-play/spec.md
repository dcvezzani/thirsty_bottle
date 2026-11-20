# table-play Specification

## Purpose
Provides a shared, rules-free card table that behaves like a physical one. Players arrange cards into zones and perform the common physical card actions, and the system enforces no game rules.

## Requirements

### Requirement: No game rules enforced
The table SHALL NOT validate moves against any game's rules. Any permitted participant SHALL be able to perform any card action on any card they can reach, subject only to the visibility, ownership and turn-mode requirements.

#### Scenario: Unconventional move allowed
- **WHEN** a player moves a card from the discard pile directly into their hand
- **THEN** the move succeeds and every participant sees the action recorded in the table log

### Requirement: Zones
The table SHALL organize card instances into zones. A zone is shared or owned by one player and has a layout: pile (stacked), spread (fanned row), column (cards cascading downward) or free (positioned anywhere). Each seat SHALL have a private hand zone. Hosts SHALL be able to add, rename, recolor, arrange and remove zones.

#### Scenario: Create a discard pile
- **WHEN** the host adds a shared zone named "Discard" with layout pile
- **THEN** every participant sees an empty "Discard" pile on the table

#### Scenario: Remove non-empty zone
- **WHEN** the host removes a zone that still contains cards
- **THEN** the system asks where to move its cards, and removes the zone only after they are moved

### Requirement: Zone order and rows
Shared zones SHALL appear in one order that is the same for every participant. Each shared zone SHALL have a width (fit, half or full) and MAY start a new row. Each device SHALL wrap the order into rows that fit its screen.

#### Scenario: Same order on different screens
- **WHEN** a table has zones Stock, Waste, F1 to F4 and P1 to P7, viewed on a desktop and on a 375-pixel phone
- **THEN** both show the zones in the same order, and each wraps them into rows that fit its own width

#### Scenario: Width defaults from layout
- **WHEN** the host adds a pile, a column and a spread without choosing widths
- **THEN** the pile and the column are as wide as one card, and the spread takes a full row

#### Scenario: Start a new row
- **WHEN** the host turns on "Start a new row" for P1 while there is room for P1 after F4
- **THEN** P1 begins a new row on every device

#### Scenario: Existing tables keep their look
- **WHEN** a table created before this change is opened
- **THEN** its zones appear in the order they were shown before: piles first, then the other zones by their previous row and then column

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

### Requirement: Private hands
Cards in a player's hand zone SHALL be visible only to that player, unless the player shows them. Other participants SHALL see only how many cards are in the hand and their backs.

#### Scenario: Opponent sees card count only
- **WHEN** a player draws 3 cards into their hand
- **THEN** other participants see the hand count increase by 3 and do not learn which cards were drawn

### Requirement: Show cards
A player SHALL be able to show one or more cards they can see to a chosen set of players or to everyone. Showing does not move the cards. It lasts until the holder ends it or the cards move.

#### Scenario: Show a card to one player
- **WHEN** a player shows a card in their hand to exactly one other player
- **THEN** only that player can see the card's front and open its info, and all participants see a log entry "Alex showed 1 card to Sam" with the card hidden from others

#### Scenario: Show ends on move
- **WHEN** a shown card is moved out of the holder's hand
- **THEN** the show ends and the card's visibility follows its new zone and face state

### Requirement: Peek
A player SHALL be able to privately look at a face-down card, or the top N cards of a pile, without flipping them. All participants SHALL be notified that a peek happened but not which cards were seen.

#### Scenario: Peek at top of deck
- **WHEN** a player peeks at the top 2 cards of the draw pile
- **THEN** only that player sees those two fronts, the cards stay face down in place, and others see "Alex peeked at 2 cards"

### Requirement: Move and pass cards
A participant SHALL be able to move one or more cards from any zone they can reach to any position in another zone, including another player's hand (passing). The card's face state SHALL be preserved unless the player chooses to flip during the move.

#### Scenario: Pass cards to a player
- **WHEN** a player selects 3 cards in their hand and passes them to another player
- **THEN** the 3 cards move to the recipient's hand, only the recipient sees them, and the log reads "Alex passed 3 cards to Sam"

#### Scenario: Play face down
- **WHEN** a player drags a card from their hand to a shared spread and chooses "face down"
- **THEN** the card appears face down in the spread and no participant learns its identity

### Requirement: Taking from other hands requires consent
Moving cards out of another player's hand SHALL require that player's approval, unless the host has enabled "open hands" for the table.

#### Scenario: Request to take a card
- **WHEN** a player tries to take a card from another player's hand
- **THEN** the hand owner receives a prompt to approve or decline, and the card moves only if they approve

### Requirement: Shuffle
A participant SHALL be able to shuffle a pile. The server SHALL shuffle uniformly at random using a cryptographically secure random source.

#### Scenario: Shuffle a pile
- **WHEN** a player shuffles the draw pile
- **THEN** the order of its cards is randomized on the server, all participants see a shuffle animation and log entry, and no client learns the new order of face-down cards

### Requirement: Cut
A participant SHALL be able to cut a pile at a chosen or random depth, either moving the top portion beneath the bottom portion or splitting it into a new pile.

#### Scenario: Cut and complete
- **WHEN** a player cuts a 52-card pile at depth 20
- **THEN** the top 20 cards are placed under the remaining 32 cards

### Requirement: Draw from top, bottom or random
A participant SHALL be able to draw N cards from the top, the bottom, or random positions of a pile into their hand or another zone.

#### Scenario: Draw from bottom
- **WHEN** a player draws 1 card from the bottom of the draw pile
- **THEN** the bottom card moves into that player's hand and only they see its face

#### Scenario: Draw random
- **WHEN** a player draws 2 random cards from a pile
- **THEN** the server picks 2 positions using the secure random source and moves those cards

#### Scenario: Draw more than available
- **WHEN** a player requests 5 cards from a pile holding 3
- **THEN** the 3 available cards are drawn and the player is told the pile is empty

### Requirement: Deal
A participant SHALL be able to deal N cards to each chosen seat (or seat zone) from a pile, round-robin in seat order starting from a chosen seat, face up or face down.

#### Scenario: Deal hearts
- **WHEN** a player deals 13 cards to each of 4 seats from a 52-card pile
- **THEN** each seat's hand holds 13 cards dealt one at a time in rotation and the pile is empty

### Requirement: Gather and reset
A participant SHALL be able to gather all cards from selected zones back into one pile face down. The host SHALL be able to reset the table to its initial setup.

#### Scenario: Gather for next round
- **WHEN** a player gathers all cards from every zone into the draw pile
- **THEN** all cards are in the draw pile face down and every show and peek has ended

### Requirement: Tokens and counters
The table SHALL support generic counters (a labeled number that anyone can increment or decrement) and a shared notes area for scores and resources. No meaning is attached to their values.

#### Scenario: Track a score
- **WHEN** a player adds a counter "Alex score" and increments it by 26
- **THEN** every participant sees "Alex score: 26"

### Requirement: Table log and undo
The table SHALL keep an ordered, timestamped log of all actions, worded so that it reveals no hidden information. The participant who performed the most recent action SHALL be able to undo it within 10 seconds, provided no other action has happened since.

#### Scenario: Undo a misplay
- **WHEN** a player moves a card to the wrong zone and presses undo within 10 seconds, before anyone else acts
- **THEN** the card returns to its previous zone, position and face state, and the log records the undo

### Requirement: Spectators
Spectators SHALL see shared zones, counters and the log, but SHALL NOT see private hands or perform card actions.

#### Scenario: Spectator view
- **WHEN** a spectator watches a table
- **THEN** they see face-up shared cards and hand counts, and every card action control is hidden

### Requirement: Copy number display
Card faces of definitions with more than one instance SHALL show a small copy-number badge (for example "2/3") in a corner, without altering the artwork. Log entries, move menus and selection summaries that name a visible duplicate SHALL include its copy number. Copy numbers SHALL never be shown for a card whose face the viewer cannot see.

#### Scenario: Badge on a visible duplicate
- **WHEN** "Goblin #2 of 3" is face up in a shared spread
- **THEN** every participant sees a "2/3" badge on its face

#### Scenario: Single copy has no badge
- **WHEN** a card whose definition has instance count 1 is face up
- **THEN** no copy-number badge is shown on its face

#### Scenario: Log names the copy
- **WHEN** Alex plays "Goblin #2 of 3" face up
- **THEN** the log reads "Alex played Goblin #2"

#### Scenario: Face-down duplicates are indistinguishable
- **WHEN** two copies of "Goblin" lie face down in a spread
- **THEN** both show the identical back image with no badge or other distinguishing mark

### Requirement: Action feedback
The client SHALL animate card movement, flips, shuffles and deals. It SHALL indicate the actor (for example, a highlight in the player's color or a short floating label) so participants can follow what happened.

#### Scenario: Watch another player draw
- **WHEN** another player draws a card
- **THEN** a card back visibly travels from the pile to that player's seat, labeled with their name

### Requirement: Arranging zones
The host SHALL be able to enter an arrange mode by long-pressing a zone label or from the table settings. There, each shared zone SHALL be a tile that can be dragged to a new place in the order, showing a gap where it will land, with its width and "Start a new row" settings on the tile. Cards SHALL NOT be movable while arranging. Every participant SHALL see each change as it is made.

#### Scenario: Drag a zone to a new place
- **WHEN** the host, in arrange mode, drags the Discard tile from the end of the order to just after Stock
- **THEN** a gap opens after Stock during the drag, and on release Discard appears after Stock for every participant

#### Scenario: Scroll while dragging a tile
- **WHEN** the host holds a dragged tile near the bottom edge of the board while the destination is below the visible area
- **THEN** the board scrolls toward that edge

#### Scenario: Cards are locked while arranging
- **WHEN** the host tries to drag a card while in arrange mode
- **THEN** no card moves

### Requirement: Arranging from the zone sheet
The zone sheet SHALL offer Move earlier, Move later, a width choice (fit, half, full) and "Start a new row", so zones can be arranged without dragging, including by keyboard and screen reader.

#### Scenario: Arrange without dragging
- **WHEN** the host opens P3's zone sheet and taps Move earlier
- **THEN** P3 swaps places with the zone before it for every participant

### Requirement: Only the host arranges zones
Only the host SHALL be able to change the zone order, widths or row breaks. If the host role passes to another player, arrange mode SHALL close for the former host.

#### Scenario: Non-hosts cannot arrange
- **WHEN** a player who is not the host long-presses a zone label
- **THEN** arrange mode does not open, and the zone sheet shows no arrange controls

#### Scenario: Host role passes while arranging
- **WHEN** the host hands the host role to another player while in arrange mode
- **THEN** arrange mode closes for the former host

### Requirement: Set every card's face
A participant SHALL be able to make every card in a zone face up, or every card face down, without changing their order. This SHALL be available for every layout and SHALL be one action with one log entry and one undo.

#### Scenario: Square up a mixed pile
- **WHEN** a player chooses "All face down" on a pile whose cards from top to bottom are A (down), B (up), C (up)
- **THEN** the pile reads A, B, C from top to bottom, all face down

#### Scenario: Reveal a pile in place
- **WHEN** a player chooses "All face up" on a face-down pile whose cards from top to bottom are A, B, C
- **THEN** the pile reads A, B, C from top to bottom, all face up, and A shows on top
