## MODIFIED Requirements

### Requirement: Gather and reset
A participant SHALL be able to gather all cards from selected zones back into one pile face down. When more than one deck is loaded, a participant SHALL also be able to gather only one deck's cards into a zone: from every zone and hand, face down, ending shows and peeks on those cards only, and leaving other decks' cards as they are. The host SHALL be able to reset the table to its initial setup.

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
