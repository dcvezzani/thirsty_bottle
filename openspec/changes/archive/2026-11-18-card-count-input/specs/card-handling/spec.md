# Spec Delta

## ADDED Requirements

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
