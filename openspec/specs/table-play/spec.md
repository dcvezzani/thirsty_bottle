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
A participant SHALL be able to gather all cards from selected zones back into one pile face down and upright. When more than one deck is loaded, a participant SHALL also be able to gather only one deck's cards into a zone: from every zone and hand, face down and upright, ending shows and peeks on those cards only, and leaving other decks' cards as they are. The host SHALL be able to reset the table to its initial setup.

#### Scenario: Gather for next round
- **WHEN** a player gathers all cards from every zone into the draw pile
- **THEN** all cards are in the draw pile face down and every show and peek has ended

#### Scenario: Gather one deck
- **WHEN** Monopoly Deal and Standard 52 are loaded, cards of both are spread over zones and hands, and a player taps "Gather Monopoly Deal here" on the Draw pile
- **THEN** every Monopoly Deal card is in the Draw pile face down, every Standard 52 card stays where it was with its face unchanged, and the log says how many Monopoly Deal cards were gathered

#### Scenario: Other decks keep their reveals
- **WHEN** a Standard 52 card is shown to Sam and the player gathers Monopoly Deal
- **THEN** the Standard 52 card is still shown to Sam

#### Scenario: One deck loaded
- **WHEN** only one deck is loaded and a player opens a zone's sheet
- **THEN** only "Gather all here" is offered

#### Scenario: Gathering returns cards upright
- **WHEN** a Monopoly Deal card rotated 90° and a Standard 52 card rotated 45° are on the table and a player gathers Monopoly Deal
- **THEN** the Monopoly Deal card is upright in the draw pile and the Standard 52 card is still rotated 45°

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

### Requirement: Zone card count
Every shared zone's label SHALL show how many cards the zone holds. The count SHALL stay fully visible however narrow the zone is; when the label does not fit, the zone's name SHALL be shortened instead.

#### Scenario: Narrow pile with a long name
- **WHEN** a fit-width pile named "Standard 52" holds 27 cards on a 375-pixel phone
- **THEN** its label shows the full count "27", with the name shortened

#### Scenario: Seven columns on a phone
- **WHEN** seven column zones named "Tableau 1" to "Tableau 7" share a row on a 375-pixel phone and "Tableau 3" holds 12 cards
- **THEN** each label shows its full count, and "Tableau 3" shows "12"

#### Scenario: Empty zone bar
- **WHEN** an empty zone is shown as a slim bar
- **THEN** its label shows the count 0 in full

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
A per-player zone SHALL take one slot in the shared zone order. Each seated player SHALL see their own copy in that slot, labelled with the zone's name, and SHALL NOT see other players' copies on their board. Arranging SHALL move the zone for everyone. Spectators SHALL see no copy on the board.

#### Scenario: Same slot, own cards
- **WHEN** the per-player Tableau sits between Stock and Discard
- **THEN** Alex sees their Tableau there and Sam sees their own Tableau in the same place

#### Scenario: Narrow zones keep their name
- **WHEN** a per-player zone named "P1.1" is shown at fit width on a phone
- **THEN** its label reads "P1.1", not a shortened "Your P1.1"

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
Each copy SHALL show its card count on its owner's board. A seat's sheet SHALL list that player's per-player zones with their counts and cards: face-up cards visible, face-down cards as backs. It SHALL offer the actions the viewer may take there: ask to take, take when open hands is on, and pass cards in.

#### Scenario: Counts in the seat bar
- **WHEN** Alex's Tableau holds 3 cards
- **THEN** Sam's seat bar shows only Alex's name and hand count, and Alex's seat sheet shows Tableau with 3 cards

#### Scenario: Seat sheet shows face-up cards
- **WHEN** Sam opens Alex's seat sheet while Alex's Tableau holds a face-up King and a face-down card
- **THEN** the sheet shows the King's face and one card back under Tableau

### Requirement: Viewing another player's table
Any player or spectator SHALL be able to switch their board to another seat's view and back. A seat sheet SHALL offer "View table". While viewing, a banner SHALL name the viewed seat and offer previous, next (wrapping through the seats in table order) and "Mine". Spectators SHALL be able to rotate through every seat.

#### Scenario: Rotate through the seats
- **WHEN** Alex views Sam's table at a table with Alex, Sam and Kim, and taps next twice
- **THEN** Alex sees Kim's table and then Alex's own, and "Mine" returns to Alex's own view at any time

### Requirement: Actions while viewing another player's table
While viewing another seat, the viewer's actions SHALL follow the existing rules. Taking cards from that seat's hand or per-player zones SHALL ask for consent unless open hands is on. Dropping cards onto them SHALL pass the cards. Flip, shuffle and peek SHALL NOT be offered on that seat's zones, and shared zones SHALL work as in the viewer's own view.

#### Scenario: Drag out asks
- **WHEN** Alex, viewing Sam's table, drags a card out of Sam's Tableau into Alex's hand with open hands off
- **THEN** Sam is asked to allow it

#### Scenario: Pass by dropping
- **WHEN** Alex, viewing Sam's table, drags a card from Alex's hand onto Sam's Tableau
- **THEN** the card moves to Sam's Tableau

### Requirement: Who is viewing whom
While anyone views another seat, that seat's player SHALL see an indicator naming each viewing player and counting viewing spectators. Every participant SHALL be able to see, in a viewing player's seat sheet, which seat they are viewing. The indicators SHALL disappear when the viewer returns to their own view, views another seat, leaves or disconnects.

#### Scenario: Sam can tell
- **WHEN** Alex views Sam's table
- **THEN** Sam sees an indicator naming Alex, and Kim's seat sheet for Alex says "viewing Sam"

#### Scenario: Indicator clears
- **WHEN** Alex returns to their own view
- **THEN** Sam's indicator and the "viewing" line in Alex's seat sheet disappear

### Requirement: One-line seat chips
Each seat chip in the seat bar SHALL show only the player's name (with a crown for the host) and their hand count, on one line. Other details SHALL be in the seat's sheet: host and connection status, which table they are viewing, cards shown to the viewer, and their per-player zones. The chip's accessible name SHALL include the full status. Highlights that add no height, such as the active turn and a pass drop target, SHALL remain.

#### Scenario: Many per-player zones, one line
- **WHEN** George has seven per-player zones and is disconnected
- **THEN** George's chip shows only "George" and his hand count on one line, and his seat sheet lists the seven zones and says he is disconnected

#### Scenario: Status for screen readers
- **WHEN** a screen reader reads George's chip while he is disconnected and viewing Sam's table
- **THEN** it hears his name, that he is disconnected, that he is viewing Sam, and his hand count

### Requirement: Another seat's zones in view
A view of another seat SHALL show the shared zones as usual and that seat's copy of each per-player zone in its slot. Card faces SHALL follow what the viewer may see: the face rules in per-player zones, and hand cards hidden unless they were shown or peeked to the viewer.

#### Scenario: Sam's areas in place
- **WHEN** Alex views Sam's table while Sam's Tableau holds a face-up King and a face-down card
- **THEN** Alex sees Sam's Tableau in its slot with the King face up and one card back

### Requirement: Hand dock while viewing another table
While a player views another seat, the hand area SHALL be a dock as tall as the viewer's own hand area on their own table, whether or not cards are shown, so the board never resizes. The dock SHALL hold two columns of normal-size, full-height cards: the viewed player's hand on the left and the viewer's own hand on the right. The focused column SHALL take about two thirds of the width. A spectator SHALL get one full-width column.

#### Scenario: Same height as my own table
- **WHEN** Alex's hand area is a given height on Alex's own table and Alex views Sam's table, with and without cards shown to Alex
- **THEN** the dock is the same height in every case and the board does not move

#### Scenario: Their hand is focused by default
- **WHEN** Alex starts viewing Sam's table
- **THEN** Sam's column is the wide one and Alex's own column is the narrow one

#### Scenario: Spectator
- **WHEN** a spectator views Sam's table
- **THEN** the dock is one full-width column showing Sam's hand

### Requirement: Focusing a hand column
Sliding along the narrow column, or carrying cards over it, SHALL make it the focused wide column and the other the narrow one. The focus SHALL stay until the other column is slid along or carried over, and a tap SHALL NOT change it. Focus SHALL return to the viewed player's hand whenever the viewer starts viewing a different table. While the columns resize, the scrub preview SHALL pause briefly and then continue from the finger's position.

#### Scenario: Slide over my own hand
- **WHEN** Alex slides along their narrow hand while viewing Sam's table
- **THEN** Alex's column becomes wide, Sam's becomes narrow, and both stay that way after Alex lifts their finger

#### Scenario: Slide back
- **WHEN** Alex then slides along Sam's narrow column
- **THEN** Sam's column is the wide one again

#### Scenario: A tap does not change focus
- **WHEN** Alex taps a card in the narrow column
- **THEN** the card is selected and the column widths do not change

#### Scenario: Rotating resets the focus
- **WHEN** Alex has focused their own hand and rotates to Kim's table
- **THEN** Kim's column is the wide one

#### Scenario: Carrying a card to the other column
- **WHEN** Alex has focused their own hand and carries a card over Sam's narrow column
- **THEN** Sam's column widens, and dropping the card passes it to Sam

### Requirement: Cards in the viewed hand
The viewed hand's column SHALL fan all of that player's cards like the viewer's own hand: cards shown to the viewer first and face up, then the hidden cards as backs. Each column SHALL carry a small badge with the owner's name, card count and how many are shown to the viewer, adding no height. An empty viewed hand SHALL say so by the owner's name. A card shown to the viewer while the viewed column is narrow SHALL make it pulse and update its badge, without changing the focus.

#### Scenario: A shown card is readable
- **WHEN** Sam shows two cards from a hand of 5 to Alex while Alex views Sam's table
- **THEN** Sam's column fans 5 cards: the two shown cards first and face up, then three backs

#### Scenario: Nothing shown
- **WHEN** Alex views Sam's table and none of Sam's 5 cards is shown to Alex
- **THEN** Sam's column fans 5 backs and the badge says 5 cards, none shown, at the same dock height

#### Scenario: Empty viewed hand
- **WHEN** Alex views Sam's table and Sam holds no cards
- **THEN** the column says "Sam's hand is empty", not "Your hand is empty"

#### Scenario: Shown while my hand is focused
- **WHEN** Alex has focused their own hand and Sam shows Alex a card
- **THEN** Sam's narrow column pulses and its badge counts the shown card, and the focus does not change

### Requirement: Picking from the viewed hand
Every card in the viewed hand's fan, backs included, SHALL respond like a card in the viewer's own hand: tapping selects it, sliding previews it (a back shows only its back), and dragging it out is a take. Taking SHALL follow the existing rules, asking the owner unless open hands is on. While the selection is in another player's hand or zone, the selection toolbar SHALL offer Ask to take (Take with open hands) instead of Flip and send again.

#### Scenario: Pick a card blindly
- **WHEN** Alex taps the third back in Sam's fan and taps Ask to take
- **THEN** Sam is asked to allow Alex to take 1 card, and Alex does not learn which card it is before Sam allows it

#### Scenario: Take with open hands
- **WHEN** open hands is on and Alex drags a back out of Sam's fan onto Alex's own hand
- **THEN** the card moves to Alex's hand at once

#### Scenario: Toolbar for another player's cards
- **WHEN** Alex selects a card in Sam's fan
- **THEN** the selection toolbar offers Ask to take, and does not offer Flip or send again

### Requirement: Requesting to see a hand
A seated player viewing another player's table SHALL be able to ask to see that player's hand, from the viewed column or the player's seat sheet, while some of its cards are hidden from them. The owner SHALL get a prompt to allow or decline. A pending request SHALL end when answered, cancelled, when either player leaves their seat, or when the asker stops viewing that table. Spectators SHALL NOT be able to ask. Asking and answering SHALL work out of turn.

#### Scenario: Ask and wait
- **WHEN** Dave views George's table and taps "Ask to see hand"
- **THEN** George is prompted "Dave asks to see your hand" with Allow and Decline, and Dave's control reads "Asked…" until George answers or Dave cancels

#### Scenario: Decline
- **WHEN** George declines
- **THEN** Dave's view stays as it was, Dave is told George declined, and the log says so without naming any card

#### Scenario: Spectators cannot ask
- **WHEN** a spectator views George's table
- **THEN** no control to ask to see George's hand is offered, and the request is refused if sent

#### Scenario: Out of turn
- **WHEN** it is another player's turn in turn-based mode and Dave asks to see George's hand
- **THEN** the request is made and George can answer it

#### Scenario: Asker stops viewing
- **WHEN** Dave has a pending request and returns to his own table
- **THEN** the request ends and George's prompt goes away

### Requirement: Showing a whole hand
When the owner allows, every card currently in their hand SHALL be shown to the asker, exactly as showing those cards to that player. The asker SHALL see their fronts in the viewed fan and be able to scrub through them. Cards added to the hand later SHALL stay hidden, and a card that leaves the hand SHALL leave the reveal. The log SHALL say the hand was shown without naming cards, and the owner SHALL be able to stop showing their hand in one tap.

#### Scenario: Allow shows every front
- **WHEN** George allows Dave's request while holding 6 cards
- **THEN** Dave sees all 6 fronts in George's fan, can scrub through them, and the badge reads 6 shown

#### Scenario: A later card stays hidden
- **WHEN** George draws a seventh card after allowing
- **THEN** Dave sees 6 fronts and one back

#### Scenario: A played card leaves the reveal
- **WHEN** George plays one of the shown cards to the table
- **THEN** that card follows the table's face rules and Dave still sees the remaining shown fronts

#### Scenario: The owner stops showing
- **WHEN** George taps "Stop showing my hand"
- **THEN** Dave's view of George's hand returns to backs, and the eye marks on George's cards disappear

### Requirement: Requests expire
A request to take cards from another player's hand, and a request to see a hand, SHALL expire five seconds after it is made if the owner has not answered. Expiry SHALL count as no answer: nothing is taken or shown, the owner's prompt closes, the asker's control returns so they can ask again, the log says the request expired, and the asker is told. An answer arriving after expiry SHALL be refused as expired. Expiry SHALL NOT end anyone's undo window.

#### Scenario: Unanswered take request
- **WHEN** Alex asks to take a card from Sam's hand and Sam does not answer for 5 seconds
- **THEN** Sam's prompt closes, the card has not moved, the log says the request expired, and Alex is told Sam did not answer in time

#### Scenario: Unanswered request to see a hand
- **WHEN** Dave asks to see George's hand and George does not answer for 5 seconds
- **THEN** George's prompt closes, Dave still sees backs, Dave's "Ask to see" control returns, and Dave is told George did not answer in time

#### Scenario: Late answer
- **WHEN** Sam taps Allow after the request has expired
- **THEN** nothing is taken or shown, and Sam is told the request has expired

#### Scenario: Ask again
- **WHEN** a request has expired
- **THEN** the asker can make the same request again immediately

#### Scenario: Undo survives an expiry
- **WHEN** Sam makes an undoable move 2 seconds after a request to Sam was made, and the request expires 3 seconds later
- **THEN** Sam can still undo the move

### Requirement: Request countdown
While a request is pending, the owner's prompt and the asker's waiting banner SHALL show the seconds left, counted from the remaining time the server reports so that differences between the devices' clocks do not matter. A request that was pending when the server restarted SHALL keep only the time it had left, and expire at once if it was already overdue.

#### Scenario: Countdown shown
- **WHEN** a request is pending
- **THEN** the owner's prompt shows a shrinking bar and the seconds left, and the asker's banner shows the seconds left, both counting down from about 5

#### Scenario: Clocks disagree
- **WHEN** the asker's device clock is a minute ahead of the owner's
- **THEN** both countdowns still end within a second of each other, when the server expires the request

#### Scenario: Server restart
- **WHEN** the server restarts 3 seconds after a request was made
- **THEN** the request expires about 2 seconds after the restart

### Requirement: Card rotation
Every card instance SHALL have a rotation in 45° steps (0°, 45°, 90° … 315°), upright (0°) by default and the same for every participant. A rotation SHALL stay until it is changed or the card is gathered back. Moving, drawing, dealing and shuffling cards, and turning a pile over, SHALL NOT change it. A card SHALL keep its rotation in every zone, including hands, and cards in other players' hands SHALL show their rotation like their face state.

#### Scenario: Rotation stays through a move
- **WHEN** a card is rotated 90° in Alex's hand and Alex plays it to the Table spread
- **THEN** the card is in the Table spread still rotated 90°, and every participant sees it rotated

#### Scenario: Rotation stays through a shuffle and a draw
- **WHEN** a rotated card is in a pile that is shuffled and then drawn into a hand
- **THEN** the card has the same rotation in the hand

#### Scenario: Turning a pile over
- **WHEN** a player turns over a pile that holds a card rotated 45°
- **THEN** the pile reverses and the card is still rotated 45°

#### Scenario: Tables from before rotation
- **WHEN** a table saved before rotation existed is loaded
- **THEN** every card is upright

### Requirement: Rotating cards
Any participant who may flip a card SHALL be able to rotate it by one or more 45° steps in either direction, or return it to upright, for a selection of cards in one action and for every card in a zone in one action. Rotating SHALL be logged as a card action, SHALL be undoable like flipping, and SHALL be refused for cards in another player's zone when hands are not open.

#### Scenario: Rotate a selection
- **WHEN** a player selects 3 cards in a spread and rotates them by one step
- **THEN** all 3 cards are rotated 45°, the log says the player rotated 3 cards, and one undo returns them upright

#### Scenario: Rotate every card in a zone
- **WHEN** a player rotates every card in a spread by two steps
- **THEN** each card in the spread is rotated 90° more than it was

#### Scenario: Another player's zone
- **WHEN** a player tries to rotate a card in another player's hand while hands are not open
- **THEN** nothing is rotated and the player is told it is not their zone

#### Scenario: Back to upright
- **WHEN** a player sets a card rotated 135° to upright
- **THEN** the card is rotated 0°
