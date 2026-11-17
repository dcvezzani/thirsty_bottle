# Spec Delta

## ADDED Requirements

### Requirement: Change display name and color
A player SHALL be able to change their display name (1–24 characters) and color at any time after onboarding. The change SHALL appear in the lobby presence list, on their seat at any table they are at, and on chat messages they send afterwards. Earlier chat messages keep the name they were sent with.

#### Scenario: Rename while seated
- **WHEN** a seated player changes their name from "Alex" to "Alexandra"
- **THEN** other players see "Alexandra" in the lobby list and on that seat

#### Scenario: Invalid name
- **WHEN** a player submits an empty or 25-character name
- **THEN** the change is refused and their name is unchanged
