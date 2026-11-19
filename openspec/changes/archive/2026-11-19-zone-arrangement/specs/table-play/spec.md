## MODIFIED Requirements

### Requirement: Zones
The table SHALL organize card instances into zones. A zone is shared or owned by one player and has a layout: pile (stacked), spread (fanned row), column (cards cascading downward) or free (positioned anywhere). Each seat SHALL have a private hand zone. Hosts SHALL be able to add, rename, recolor, arrange and remove zones. Shared zones SHALL appear in one order that is the same for every participant. Each shared zone SHALL have a width (fit, half or full) and MAY start a new row. Each device SHALL wrap the order into rows that fit its screen.

#### Scenario: Create a discard pile
- **WHEN** the host adds a shared zone named "Discard" with layout pile
- **THEN** every participant sees an empty "Discard" pile on the table

#### Scenario: Remove non-empty zone
- **WHEN** the host removes a zone that still contains cards
- **THEN** the system asks where to move its cards, and removes the zone only after they are moved

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

## ADDED Requirements

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
