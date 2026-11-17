# Spec Delta

## ADDED Requirements

### Requirement: Report a public deck
Any player who can view a public deck that is not built in SHALL be able to report it, with an optional reason. A report SHALL hide the deck from the public gallery until an admin reviews it. Reporting the same deck again by the same player SHALL have no additional effect.

#### Scenario: Report hides from the gallery
- **WHEN** a player reports a public deck
- **THEN** the deck no longer appears in gallery searches, and its owner still sees it in their library

#### Scenario: Built-in decks cannot be hidden
- **WHEN** a player reports a built-in deck
- **THEN** the built-in deck stays available to everyone

### Requirement: Admin review of reports
A server operator SHALL be able to list reported decks with report counts and reasons, unhide a deck (which clears its reports and returns it to the gallery), or hide a deck, using a command-line tool run against the server's data directory.

#### Scenario: Unhide after review
- **WHEN** the operator runs the unhide command for a reported public deck
- **THEN** the deck appears in the gallery again and its reports are cleared

#### Scenario: List reports
- **WHEN** the operator runs the reports command
- **THEN** each reported deck is listed with its name, number of reports and reasons
