## ADDED Requirements

### Requirement: Viewing presence
The server SHALL keep which seat each connected participant is viewing in memory only, never in table state, the log or undo. It SHALL relay changes to everyone at the table, include the current viewers in snapshots, and clear a participant's entry when they stop viewing, leave or disconnect. Viewing messages SHALL be rate-limited like drag previews.

#### Scenario: A reload sees current viewers
- **WHEN** Sam reloads while Alex is viewing Sam's table
- **THEN** Sam's snapshot shows Alex viewing, and the table's saved state contains no viewing data

#### Scenario: Disconnect clears
- **WHEN** Alex disconnects while viewing Sam's table
- **THEN** everyone's indicator for Alex disappears
