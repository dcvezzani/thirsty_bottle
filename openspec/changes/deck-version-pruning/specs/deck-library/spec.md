# Spec Delta

## ADDED Requirements

### Requirement: Prune unreferenced old versions
The system SHALL periodically delete saved deck versions that are older than 30 days and are neither a deck's current version nor referenced by any table snapshot. Pruning SHALL NOT affect current versions, unsaved drafts or decks loaded on tables. Images used only by pruned versions SHALL then become eligible for garbage collection.

#### Scenario: Old superseded version
- **WHEN** a deck has been saved several times and its first version is 40 days old and not loaded on any table
- **THEN** that version is deleted, and the current version and draft are unchanged

#### Scenario: Version in use on a table
- **WHEN** a 40-day-old version is loaded on an open table
- **THEN** it is kept and the table keeps working
