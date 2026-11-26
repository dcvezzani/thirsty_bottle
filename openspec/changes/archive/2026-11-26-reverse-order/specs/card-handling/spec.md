## ADDED Requirements

### Requirement: Reverse order controls
The selection actions sheet SHALL offer Reverse order for the selected cards, and a zone's sheet SHALL offer Reverse order for every card in the zone. Each is one action; neither is offered for cards the player may not flip, and reversing the selected cards SHALL keep the selection.

#### Scenario: Reverse the selection from the sheet
- **WHEN** a player selects the whole fan of cards in their hand, opens the actions sheet and taps Reverse order
- **THEN** the hand's order is reversed, the same cards are still selected, and the player can move them to a pile right away

#### Scenario: Reverse a zone from its sheet
- **WHEN** a player opens a spread's sheet and taps Reverse order
- **THEN** every card in the spread is in the opposite order

#### Scenario: Not in another player's zone
- **WHEN** a player has selected cards in another player's hand
- **THEN** Reverse order is not offered
