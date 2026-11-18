# card-handling Specification

## Purpose
Makes viewing, selecting and moving cards fast and tedium-free on touch screens: scrubbing through fans and spreads, paint-selecting groups, and moving many cards in one smooth gesture.

## Requirements

### Requirement: Mobile hand and board layout
On narrow screens the client SHALL show the player's own hand as a fanned arc along the bottom edge, with spacing that adapts to the card count. Shared zones SHALL be laid out above it, scrollable and zoomable.

#### Scenario: Large hand on phone
- **WHEN** a player holds 20 cards on a 375-pixel-wide screen
- **THEN** all 20 cards stay reachable in the fanned hand, with overlap increased and the selected card raised

### Requirement: Scrub to preview
Pressing and sliding along a fanned hand or spread SHALL show the card under the finger enlarged above the finger. Neighboring cards part slightly so the card can be read. Releasing changes nothing.

#### Scenario: Scrub through own hand
- **WHEN** a player presses on their hand and slides sideways across 6 overlapping cards
- **THEN** each card in turn appears enlarged above the finger as it passes, and on release the hand and selection are unchanged

#### Scenario: Scrub over hidden cards
- **WHEN** a player scrubs across a spread containing face-down cards
- **THEN** face-down cards preview only their back image

#### Scenario: Haptic tick
- **WHEN** the scrub moves onto a new card on a device that supports vibration
- **THEN** the device gives a short haptic tick

### Requirement: Fan out a pile for scrubbing
A player SHALL be able to temporarily fan out any pile to scrub through it, then collapse it again. Fanning out SHALL NOT change card order or face state, and hidden cards SHALL show only their backs.

#### Scenario: Browse the discard pile
- **WHEN** a player fans out a face-up discard pile of 15 cards and scrubs through it
- **THEN** they can preview every card, and on collapse the pile is unchanged for all participants

### Requirement: Gesture disambiguation
The client SHALL classify a press by its first movement. Sideways movement is a scrub, movement up or out of the zone picks up cards to drag, a stationary hold of about 450 ms opens card info, and a quick tap toggles selection.

#### Scenario: Scrub then pull out
- **WHEN** a player scrubs to a card and then moves the finger upward out of the fan
- **THEN** the scrub ends and that card (or the current selection, if the card is selected) is picked up for dragging

#### Scenario: Hold still for info
- **WHEN** a player presses a card without moving for about 450 ms
- **THEN** the card info view opens and no selection or move occurs

### Requirement: Paint selection
Once at least one card in a zone is selected, scrubbing in that zone SHALL paint selection. If the scrub starts on an unselected card, every card it passes over becomes selected; if it starts on a selected card, every card it passes over becomes deselected. When nothing is selected, scrubbing is preview-only.

#### Scenario: Select five cards in one stroke
- **WHEN** a player taps one card to select it, then scrubs starting on an unselected neighbor across 4 more cards
- **THEN** 5 cards are selected

#### Scenario: Deselect by painting
- **WHEN** a player scrubs starting on a selected card across 2 other selected cards
- **THEN** those 3 cards become deselected

### Requirement: Selection controls
While any cards are selected, the client SHALL show the selection count. It SHALL offer one-tap Select all (in the zone) and Clear. The selection SHALL clear automatically after the selected cards are moved, passed or played.

#### Scenario: Select all in zone
- **WHEN** a player taps Select all while a spread of 8 cards is focused
- **THEN** all 8 cards are selected and the count shows 8

### Requirement: Group drag
Dragging any selected card SHALL carry the whole selection as one stack with a count badge, keeping the cards' relative order. Valid drop zones SHALL highlight during the drag, and dropping onto a spread or hand SHALL insert at a visible gap that opens under the drag.

#### Scenario: Drag three cards into a spread
- **WHEN** a player drags 3 selected cards over a shared spread and releases between its 2nd and 3rd cards
- **THEN** a gap opens at that position during the drag, and the 3 cards land there in their original order

#### Scenario: Drop on a seat passes cards
- **WHEN** a player drops a selected stack onto another player's seat marker
- **THEN** the cards are passed to that player's hand

### Requirement: Quick destinations
The "Move to…" action SHALL list the player's 3 most recently used destinations first. A "Send again" shortcut SHALL repeat the last destination for the current selection with one tap.

#### Scenario: Repeat a destination
- **WHEN** a player moves one selection to "Discard" and then selects another card and taps "Send again"
- **THEN** the new card moves to "Discard" without opening the menu

### Requirement: Group actions are atomic
A move, flip or pass applied to several cards SHALL be performed as one action. It produces one log entry, all participants see it at once, and one undo reverses it entirely.

#### Scenario: Undo a group pass
- **WHEN** a player passes 5 cards in one drag and then presses undo within the undo window
- **THEN** all 5 cards return to the player's hand in their original positions

### Requirement: Handling responsiveness
Scrub preview, paint selection and drag SHALL track the finger at the display's frame rate (target 60fps) with up to 30 overlapping cards in a zone on a mid-range phone, without waiting for the server.

#### Scenario: Scrub a big hand
- **WHEN** a player scrubs back and forth across a 30-card hand on a mid-range phone
- **THEN** the preview follows the finger with no visible stutter or lag

### Requirement: Choosing a number of cards
Wherever an action takes a number of cards (draw, deal, peek, cut depth), the player SHALL be able to type any whole number in the valid range or set it with a slider. The control SHALL take no more space than a single input field. The valid range SHALL come from the current table state, and out-of-range entries SHALL be clamped when the player finishes editing.

#### Scenario: Type a new count
- **WHEN** a player clears the Draw count and types `12`
- **THEN** the field shows `12`, and the action reads "Draw 12"

#### Scenario: Drag the slider
- **WHEN** a player drags the slider in the Deal sheet
- **THEN** the number updates as the slider moves, and the deal uses that count

#### Scenario: Out of range clamps on commit
- **WHEN** a player types `99` as the draw count for a 40-card pile and leaves the field
- **THEN** the count becomes `40`

#### Scenario: Deal maximum follows selected seats
- **WHEN** a player deselects one of four seats while dealing from a 52-card pile
- **THEN** the maximum per seat becomes 17, and a larger chosen count is reduced to 17

#### Scenario: Empty field disables the action
- **WHEN** the count field is empty
- **THEN** the action button is disabled until a valid count is entered

#### Scenario: Same footprint as an input
- **WHEN** the Draw sheet is shown on a 375-pixel-wide phone
- **THEN** the count control is no taller than a standard input (44 pixels) and no wider than its container
