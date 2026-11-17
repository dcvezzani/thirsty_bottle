# Spec Delta

## ADDED Requirements

### Requirement: Recovery code
A player SHALL be able to copy a recovery code for their identity, and SHALL be able to continue as that player in any window or browser by entering the code in the identity picker. The code SHALL be treated as a secret. An unknown code SHALL be refused.

#### Scenario: Continue on another device
- **WHEN** a player copies their recovery code and enters it in the identity picker of a different browser
- **THEN** that browser plays as the same player, with the same decks and table seat

#### Scenario: Unknown code
- **WHEN** someone enters a code that matches no player
- **THEN** they are told the code is unknown and no identity changes
