## ADDED Requirements

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

## MODIFIED Requirements

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
