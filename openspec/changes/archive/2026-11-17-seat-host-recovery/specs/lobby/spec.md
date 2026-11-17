# Spec Delta

## ADDED Requirements

### Requirement: Rejoin your own seat
When a player who left a seat with cards in hand joins the table again without choosing a seat, the system SHALL seat them at their own vacated seat (with its hand), provided it is still empty, before any other empty seat.

#### Scenario: Return after the grace period
- **WHEN** a player lost their seat after the reconnect grace period, their hand was kept, and they join again
- **THEN** they sit at their previous seat with the same hand

### Requirement: A seated host always exists while players are seated
When the host leaves, the host role SHALL pass to the longest-seated connected player. If the table has no seated host when a player sits down, that player SHALL become host.

#### Scenario: Everyone left, someone returns
- **WHEN** all players including the host have left and one player sits down again
- **THEN** that player becomes the host
