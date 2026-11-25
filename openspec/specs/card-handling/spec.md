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
Pressing and sliding along a fanned hand or spread SHALL show the card under the finger large in a loupe, at a fixed place that does not cover the zone being scrubbed. The loupe is at the top of the screen, or at the bottom when the pressed zone lies in the upper part of the board, chosen when the press starts and kept until it is dismissed. A scrub never changes the cards or the selection. On release the loupe goes away, unless the player's Card loupe preference is "Stay open".

#### Scenario: Scrub through own hand
- **WHEN** a player presses on their hand and slides sideways across 6 overlapping cards
- **THEN** each card in turn appears large in the loupe as it passes, and on release the hand and selection are unchanged

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
The client SHALL classify a press by its first movement. In a hand or a spread, sideways movement is a scrub and movement up or out of the zone picks up cards to drag. In a column the axes are swapped: movement along the column is a scrub, and sideways movement out of the column picks up cards. In every zone, a stationary hold of about 450 ms opens card info, a quick tap toggles selection, and two quick taps on the same card flip it.

#### Scenario: Scrub then pull out
- **WHEN** a player scrubs to a card and then moves the finger upward out of the fan
- **THEN** the scrub ends and that card (or the current selection, if the card is selected) is picked up for dragging

#### Scenario: Hold still for info
- **WHEN** a player presses a card without moving for about 450 ms
- **THEN** the card info view opens and no selection or move occurs

#### Scenario: Column axes are swapped
- **WHEN** a player presses a card in a column and slides downward
- **THEN** the column is scrubbed and no card is picked up

### Requirement: Paint selection
Once at least one card in a zone is selected, scrubbing in that zone SHALL paint selection. If the scrub starts on an unselected card, every card it passes over becomes selected; if it starts on a selected card, every card it passes over becomes deselected. When nothing is selected, scrubbing is preview-only.

#### Scenario: Select five cards in one stroke
- **WHEN** a player taps one card to select it, then scrubs starting on an unselected neighbor across 4 more cards
- **THEN** 5 cards are selected

#### Scenario: Deselect by painting
- **WHEN** a player scrubs starting on a selected card across 2 other selected cards
- **THEN** those 3 cards become deselected

### Requirement: Selection controls
While any cards are selected, the client SHALL show the selection count with a one-tap clear, and one-tap Flip and Send again to the last destination, on one line. Select all (in the zone), Clear and the face-down setting SHALL be in the actions sheet, and the toolbar SHALL show a tag while face down is on. The toolbar SHALL show a dot when there is unread chat. The selection SHALL clear automatically after the selected cards are moved, passed, played or flipped.

#### Scenario: Select all in zone
- **WHEN** a player opens the actions sheet and taps Select all while a spread of 8 cards is focused
- **THEN** all 8 cards are selected and the count shows 8

#### Scenario: Flip from the selection bar
- **WHEN** a player selects 3 face-down cards in a spread and taps Flip in the selection toolbar
- **THEN** all 3 cards turn face up in one action, and the selection clears

#### Scenario: Clear from the toolbar
- **WHEN** a player has cards selected and taps the clear control next to the count
- **THEN** the selection clears and the panel tabs return in the same row

#### Scenario: Face down is visible
- **WHEN** a player turns on face down in the actions sheet
- **THEN** the toolbar shows a face down tag until it is turned off

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

### Requirement: One-finger scrolling outside cards
When the shared zones do not fit on screen, touching any part of the board that is not a card and moving SHALL scroll the board with the platform's native momentum. This includes zone labels, empty space inside a zone, and the space between zones. One finger on a card SHALL keep the card gestures defined in this capability. The player's own hand area outside the board SHALL NOT scroll the board.

#### Scenario: One finger on an empty zone scrolls
- **WHEN** a player on a phone swipes up with one finger starting on the "Empty" area of a zone
- **THEN** the board scrolls down to show the zones below

#### Scenario: One finger on a zone label scrolls
- **WHEN** a player swipes with one finger starting on a zone's label
- **THEN** the board scrolls, and the zone's actions sheet does not open

#### Scenario: One finger on a card still handles cards
- **WHEN** a player presses a card in a row and moves sideways
- **THEN** the cards are scrubbed as before and the board does not scroll

### Requirement: Two-finger scrolling anywhere on the board
Two fingers placed anywhere on the board, including over cards, and moved together SHALL scroll the board. The second finger SHALL cancel any card gesture the first finger started, without moving, selecting or revealing cards. After release the board SHALL keep moving briefly, slowing to a stop.

#### Scenario: Two fingers over cards scroll without moving them
- **WHEN** a player puts one finger on a card, adds a second finger, and moves both upward
- **THEN** the board scrolls, no card is picked up, moved or selected, and the log has no new entry

### Requirement: Scrolling while dragging
While a player drags cards, holding them within the top or bottom edge band of the board for a short pause SHALL scroll the board toward that edge. The closer the cards are to the edge, the faster it SHALL scroll. Scrolling SHALL stop when the cards leave the band or are dropped. Cards that pass through the band without pausing SHALL NOT scroll the board.

#### Scenario: Drag to an off-screen zone
- **WHEN** a player drags a card from the hand and holds it near the bottom edge of the board while the destination zone is below the visible area
- **THEN** the board scrolls until the zone is visible, and dropping the card there moves it into that zone

#### Scenario: Passing through the edge band does not scroll
- **WHEN** a dragged card crosses the bottom edge band without pausing, on its way from the hand to a visible zone
- **THEN** the board does not scroll

### Requirement: Column height control
A column SHALL keep its height bounded. Face-down cards SHALL show as thin slivers and face-up cards SHALL show at least their rank corner. The last card SHALL be shown in full. As the column grows, the overlap SHALL tighten to keep the column within about 2.5 card heights, but never so far that a face-up card's rank corner is hidden. A very long column SHALL grow taller rather than hide ranks.

#### Scenario: Column stays compact
- **WHEN** a column holds 6 face-down cards and 6 face-up cards
- **THEN** it is no taller than about 2.5 card heights, every face-up card's rank corner is visible, and the last card is shown in full

#### Scenario: Very long column keeps ranks visible
- **WHEN** a column holds 6 face-down cards and 13 face-up cards
- **THEN** every face-up card's rank corner is still visible, and the column is only as tall as that requires

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

### Requirement: Quick flip
Two quick taps on the same card (within about 300 ms, with almost no movement) SHALL flip it. If that card is in the current selection, the whole selection SHALL be flipped instead. Two quick taps on a pile SHALL flip its top card. A quick flip SHALL be one action with one log entry and one undo, and SHALL follow the same permissions as any other flip. A single tap SHALL keep its immediate effect on cards; on a pile it MAY be delayed briefly so a second tap can be recognized.

#### Scenario: Flip one card
- **WHEN** a player double-taps a face-down card in a shared spread while nothing is selected
- **THEN** that card turns face up for everyone, nothing ends up selected, and the log records one flip

#### Scenario: Flip a selection
- **WHEN** a player has 3 cards selected and double-taps one of them
- **THEN** all 3 cards flip in one action and the selection clears

#### Scenario: Double tap outside the selection
- **WHEN** a player has 2 cards selected and double-taps a different, unselected card in the same zone
- **THEN** only that card flips, and the 2 cards stay selected

#### Scenario: Flip the top of a pile
- **WHEN** a player double-taps a face-down draw pile
- **THEN** its top card turns face up, and the zone sheet does not open

#### Scenario: Single tap on a pile still opens its sheet
- **WHEN** a player taps a pile once
- **THEN** the zone sheet opens after a short pause

#### Scenario: Out of turn
- **WHEN** a player who is not the active player double-taps a card in a shared zone in turn-based mode
- **THEN** the card does not flip and the player is told whose turn it is

#### Scenario: Mouse double-click
- **WHEN** a player double-clicks a card with a mouse
- **THEN** it flips as with a double tap

### Requirement: Moving a whole pile
A player SHALL be able to move every card of a pile to another zone in one gesture: by selecting the whole pile and dragging it, or by tapping the pile and then pressing it again and dragging within the double-tap window. A moved pile SHALL keep its order: on another pile it lands on top, in a spread at the drop gap, and in a column at the end. Moving a pile SHALL be one action with one log entry and one undo. Dragging a pile that is not selected SHALL still take only its top card.

#### Scenario: Select a pile and drag it
- **WHEN** a player chooses Select all on a 40-card pile and drags it onto the Discard pile
- **THEN** all 40 cards land on top of Discard in their original order, the log records one move, and one undo restores both piles

#### Scenario: Tap, then drag
- **WHEN** a player taps a pile and, within the double-tap window, presses it again and drags it onto a spread
- **THEN** the whole pile moves into the spread at the drop gap, and the pile's sheet does not open

#### Scenario: Tap, then release still flips
- **WHEN** a player taps a pile and then taps it again without moving
- **THEN** only the top card flips, as before

#### Scenario: Plain drag takes one card
- **WHEN** a player drags a pile that is not selected
- **THEN** only the top card is picked up

#### Scenario: Selection bar on a pile
- **WHEN** a player chooses Select all on a 52-card pile
- **THEN** the pile shows as selected, the selection bar shows 52, and Move to… moves the whole pile

### Requirement: Selecting never moves the board
Selecting or deselecting cards SHALL NOT change the size or scroll position of the board, and the selection controls SHALL NOT cover any part of it. The controls SHALL appear in the row that otherwise holds the table's panel tabs and zoom buttons, at the same height, and the tabs SHALL return when the selection clears. Starting a selection SHALL close an open chat drawer.

#### Scenario: Double tap flips whether or not the card is selected
- **WHEN** a player double-taps a card that is unselected, and then double-taps one that is already selected
- **THEN** each double tap flips its card or selection, because the cards do not move between the two taps

#### Scenario: Layout stays put
- **WHEN** a player selects a card and clears the selection
- **THEN** the board's size and the position of every zone are the same before, during and after

#### Scenario: Open drawer closes
- **WHEN** a player selects a card while the chat drawer is open
- **THEN** the drawer closes and the selection controls show in the bottom row

### Requirement: Loupe stays on one side
The loupe's side SHALL NOT change during a gesture.

#### Scenario: Zone near the top
- **WHEN** a player scrubs a zone in the upper part of the board and slides down into a zone lower on the board
- **THEN** the loupe stays at the bottom throughout and never covers the zone under the finger

### Requirement: Pause to inspect while scrubbing
While scrubbing, holding still over a card for about 300 ms SHALL show that card's full details in the loupe, as the card details view does. Moving on returns the loupe to the large card. A card whose face the viewer cannot see still shows only what the card details rules allow.

#### Scenario: Pause on a card
- **WHEN** a player scrubs a spread and holds the finger still on one card for 300 ms
- **THEN** the loupe shows that card's name, description, metadata and abilities, and sliding on shows the next card large again

#### Scenario: Pause on a hidden card
- **WHEN** the player pauses on a face-down card in another player's hand
- **THEN** the loupe shows only the back image and the holder's name

### Requirement: Scrub across zones
A sideways scrub over a row of cards SHALL continue into the next card-row zone in the row and, past the end of a row, into the first one of the next row; sliding back past the start goes to the row above. The loupe SHALL name the zone and the row, and the device SHALL tick at each zone crossing. Piles, columns and free zones are not part of the strip. A selection painted from the starting zone stays in that zone.

#### Scenario: Slide into the neighbouring zone
- **WHEN** a player scrubs to the last card of the Discard zone and keeps sliding right
- **THEN** the scrub continues onto the first card of the next zone, and the loupe names that zone

#### Scenario: Wrap to the next row
- **WHEN** the player slides past the last card of the last zone in a row
- **THEN** the scrub continues at the first card of the first zone in the next row, and sliding back returns to the row above

#### Scenario: Empty zones
- **WHEN** a zone in the strip holds no cards
- **THEN** the scrub passes it without stopping on it

### Requirement: Zones open under a held drag
While a player carries cards, holding still over a zone for about 300 ms SHALL widen that zone in place so its cards can be aimed at; the neighbouring zones make room. Releasing drops the cards at the slot under the finger and the zone closes. The loupe shows the carried card.

#### Scenario: Aim at a small zone
- **WHEN** a player drags a card over a narrow zone and holds still for 300 ms
- **THEN** the zone widens and fans its cards, the player slides to the slot they want, and releasing there drops the card in that slot

#### Scenario: Pass over a zone
- **WHEN** the player drags across a zone without holding still
- **THEN** the zone does not widen

### Requirement: Zones pinned open
Holding still over a zone while scrubbing or selecting SHALL widen it, and it SHALL stay widened after the finger lifts so that several cards can be tapped or painted. Only one zone is pinned at a time. Scrolling the board does not close it.

#### Scenario: Select several cards in a pinned zone
- **WHEN** a player pauses over a narrow zone while scrubbing, lifts the finger, and taps three of its cards
- **THEN** the zone stays widened and all three cards are selected

#### Scenario: Tap the felt
- **WHEN** a zone is pinned open with two cards selected and the player taps empty table
- **THEN** the zone returns to its normal size and the two cards stay selected

#### Scenario: Tap a control
- **WHEN** a zone is pinned open and the player taps the header's menu button
- **THEN** the menu opens and the zone closes

#### Scenario: Tap a card elsewhere
- **WHEN** a zone is pinned open and the player taps a card in another zone
- **THEN** that card's selection changes and the pinned zone closes, with the earlier selection kept

#### Scenario: Clear closes it
- **WHEN** a zone is pinned open and the player clears the selection
- **THEN** the zone closes

### Requirement: Closing a pinned zone
A pinned zone SHALL close when the player taps empty table, the header, a control, or a card in another zone (that tap still does its own action), opens a sheet or drawer, clears the selection, moves the cards out, or pins another zone. Closing keeps the selection.

#### Scenario: Selection survives closing
- **WHEN** a pinned zone closes while cards are selected
- **THEN** the same cards remain selected

### Requirement: Switch the loupe between card and details
The loupe SHALL have two views of a card: the large card and the card's details. Until the player has chosen a view, the large card shows and holding still on a card peeks at its details until the finger moves on. A choice, made by tapping the loupe (or its buttons), SHALL apply to every card shown in the loupe for the rest of the browser session until it is changed, and a pause SHALL NOT change a chosen view.

#### Scenario: Choose details while scrubbing
- **WHEN** a player scrubs with one finger and taps the loupe with a second finger, and then slides on to the next card
- **THEN** the loupe shows the next card's details

#### Scenario: Go back to the card
- **WHEN** the player taps the loupe with the second finger again
- **THEN** the loupe shows the large card again

#### Scenario: A chosen card view wins over a pause
- **WHEN** a pause is peeking at a card's details, the player taps the loupe to go back to the large card, scrubs to another card and pauses on it
- **THEN** the loupe keeps showing the large card

#### Scenario: The choice lasts the session
- **WHEN** a player has chosen the details view, lifts, and scrubs another card later, even after reloading the page
- **THEN** the loupe shows that card's details

### Requirement: Loupe mode preference
A player SHALL be able to choose, for the device they are using, between "Second finger" and "Stay open" for the card loupe, from the table settings. The default is "Second finger" on a touch device that supports two or more touch points and "Stay open" otherwise. The choice SHALL be kept in the browser and SHALL NOT be shared with other players.

#### Scenario: Default on a phone
- **WHEN** a player opens the table settings for the first time on a phone
- **THEN** the Card loupe preference reads "Second finger"

#### Scenario: Default with a mouse
- **WHEN** a player opens the table settings for the first time on a desktop with only a mouse
- **THEN** the Card loupe preference reads "Stay open"

#### Scenario: The choice is kept
- **WHEN** a player chooses "Stay open" and reloads the page
- **THEN** the preference still reads "Stay open"

#### Scenario: Second finger mode
- **WHEN** the preference is "Second finger" and a player lifts the scrubbing finger
- **THEN** the loupe goes away; and a second finger that holds or moves instead of tapping does not switch the view

### Requirement: Stay-open loupe
With the preference "Stay open", releasing a scrub SHALL leave the last card viewed: it SHALL have an outline that differs from the selection outline, the loupe SHALL stay up with a Card/Details toggle and a close button, and the card SHALL NOT be selected, shown a toolbar or given card actions. Touches outside the loupe's controls SHALL reach the board.

#### Scenario: Keep looking
- **WHEN** the preference is "Stay open" and a player scrubs to a card and lifts the finger
- **THEN** the loupe stays showing that card, the card has the viewed outline, nothing is selected, and the toggle switches between the card and its details

#### Scenario: Board stays usable
- **WHEN** a card is viewed and the player taps a card elsewhere
- **THEN** that card is selected as usual and the viewing ends

### Requirement: Ending a stay-open view
A viewed card SHALL stop being viewed, and the loupe SHALL close, when the player taps the close button, presses Escape, starts another scrub or a drag, selects a card by tapping it, taps the viewed card again, taps empty table, or opens a sheet or drawer. Panning or scrolling the board SHALL NOT end it.

#### Scenario: Tap the felt
- **WHEN** a card is viewed and the player taps empty table
- **THEN** the loupe closes and the outline goes away

#### Scenario: Scroll the board
- **WHEN** a card is viewed and the player scrolls the board
- **THEN** the loupe and the outline stay

#### Scenario: Tap the viewed card
- **WHEN** a card is viewed and the player taps it
- **THEN** the viewing ends and the card is not selected
