## MODIFIED Requirements

### Requirement: Gesture disambiguation
The client SHALL classify a press by its first movement. In a hand or a spread, sideways movement is a scrub and movement up or out of the zone picks up cards to drag. In a column the axes are swapped: movement along the column is a scrub, and sideways movement out of the column picks up cards. In every zone, a stationary hold of about 450 ms opens card info and a quick tap toggles selection.

#### Scenario: Scrub then pull out
- **WHEN** a player scrubs to a card and then moves the finger upward out of the fan
- **THEN** the scrub ends and that card (or the current selection, if the card is selected) is picked up for dragging

#### Scenario: Hold still for info
- **WHEN** a player presses a card without moving for about 450 ms
- **THEN** the card info view opens and no selection or move occurs

#### Scenario: Column axes are swapped
- **WHEN** a player presses a card in a column and slides downward
- **THEN** the column is scrubbed and no card is picked up

## ADDED Requirements

### Requirement: Column height control
A column SHALL keep its height bounded. Face-down cards SHALL show as thin slivers and face-up cards SHALL show at least their rank corner. The last card SHALL be shown in full. As the column grows, the overlap SHALL tighten so the column stays within about 2.5 card heights.

#### Scenario: Long column stays compact
- **WHEN** a column holds 6 face-down cards and 12 face-up cards
- **THEN** it is no taller than about 2.5 card heights, every face-up card's rank corner is visible, and the last card is shown in full

### Requirement: Scrubbing a column
Pressing and sliding along a column SHALL temporarily open up the cards near the finger so they can be read. Cards further away stay compressed. On release the column SHALL return to its compressed form, with nothing changed. Paint selection SHALL work during a column scrub as it does in rows. With a mouse, hovering over a column SHALL open up the cards under the pointer in the same way.

#### Scenario: Read a compressed card
- **WHEN** a player slides a finger down a compressed column and stops on the 4th card
- **THEN** the 4th card is opened up enough to read, and on release the column is compressed again and the selection is unchanged

### Requirement: Picking up from a column
Picking up a card in a column SHALL pick up that card together with every card below it, in order. If the card is selected, the current selection SHALL be picked up instead.

#### Scenario: Move a run
- **WHEN** a player presses the 3rd of 5 cards in a column and moves sideways out of it, then drops onto another column
- **THEN** the 3rd, 4th and 5th cards move together, in order, to the end of the other column

#### Scenario: Move a single selected card
- **WHEN** a player taps the 3rd of 5 cards in a column to select it, then drags it to another zone
- **THEN** only that card moves

### Requirement: Slim empty zones
An empty spread, column or free zone SHALL take only a single bar about one tap target tall (44px), showing its name and that it is empty. While cards are dragged over it, it SHALL open to full size so the cards can be dropped. Empty piles keep their card-sized slot.

#### Scenario: Empty zones save space
- **WHEN** a table has 4 empty spread zones
- **THEN** each is shown as a 44px bar

#### Scenario: Dropping into an empty zone
- **WHEN** a player drags a card over an empty zone's bar
- **THEN** the zone opens to full size, and dropping the card places it in that zone

### Requirement: Fitting a row of zones on screen
When a row of fit-width zones is wider than the screen, the client SHALL shrink the cards in that row so the whole row fits, down to a minimum readable size. Only beyond that minimum SHALL the row wrap.

#### Scenario: Seven columns on a phone
- **WHEN** a row of 7 column zones is shown on a 375-pixel-wide screen
- **THEN** all 7 columns fit side by side with smaller cards, and the page does not scroll sideways
