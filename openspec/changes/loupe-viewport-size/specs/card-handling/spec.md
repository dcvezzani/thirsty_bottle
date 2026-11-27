## MODIFIED Requirements

### Requirement: Scrub to preview
Pressing and sliding along a fanned hand or spread SHALL show the card under the finger large in a loupe docked at the top or the bottom edge of the screen, full width, covering whatever is there, the header and footer included, but not the zone being scrubbed. When the press starts, the loupe goes on the side with more free room beyond the pressed zone, the top on a tie, and stays there until it is dismissed. A scrub never changes the cards or the selection. On release the loupe goes away, unless the player's Card loupe preference is "Stay open".

#### Scenario: Scrub through own hand
- **WHEN** a player presses on their hand and slides sideways across 6 overlapping cards
- **THEN** each card in turn appears large in the loupe as it passes, and on release the hand and selection are unchanged

#### Scenario: Scrub over hidden cards
- **WHEN** a player scrubs across a spread containing face-down cards
- **THEN** face-down cards preview only their back image

#### Scenario: Haptic tick
- **WHEN** the scrub moves onto a new card on a device that supports vibration
- **THEN** the device gives a short haptic tick

## ADDED Requirements

### Requirement: The loupe fills the room beyond the zone
The loupe SHALL be as tall as the free room on its side of the pressed zone, at most 60% of the screen height; when neither side has about 35% it takes the larger side at that minimum. It SHALL be as wide as the screen with a small margin, at most about 720 px, and stay clear of the notch and home-indicator areas. The card SHALL fill the loupe's height up to the width available; Details SHALL put the card on the left and the text beside it, and True full SHALL show the card in a square box as tall as the loupe.

#### Scenario: A hand on a phone
- **WHEN** a player scrubs the hand at the bottom of a phone screen
- **THEN** the loupe is docked at the top, spans the screen's width, covers the header, is no more than 60% of the screen high, and shows the card larger than 220 px wide

#### Scenario: A zone in the middle
- **WHEN** a player scrubs a zone in the middle of the screen
- **THEN** the loupe takes the side with more room at a reduced height of at least about 35% of the screen, and stays on that side throughout

#### Scenario: A wide screen
- **WHEN** a player scrubs on a screen wider than 720 px
- **THEN** the loupe is about 720 px wide and centred

#### Scenario: Details and True full
- **WHEN** the loupe shows Details, and then True full, for a rotated card
- **THEN** Details has the card on the left and its text on the right, and True full shows the card rotated in a square as tall as the loupe
