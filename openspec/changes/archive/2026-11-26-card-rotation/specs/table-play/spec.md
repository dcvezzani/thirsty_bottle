## ADDED Requirements

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

## MODIFIED Requirements

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
