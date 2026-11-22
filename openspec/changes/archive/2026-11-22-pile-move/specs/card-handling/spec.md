## ADDED Requirements

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
