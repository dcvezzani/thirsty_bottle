## ADDED Requirements

### Requirement: Per-seat zones become per-player zones
Applying a setup SHALL create each per-seat zone as a per-player zone, with one copy for each seated player, and SHALL deal that zone's face-down and face-up cards into every copy. Players who sit down after the setup is applied SHALL get an empty copy. Saving a table as a setup SHALL record each per-player zone as a per-seat zone with its deal.

#### Scenario: Apply a per-seat tableau
- **WHEN** a setup with a per-seat zone "Reserve" dealing 3 face down is applied with Alex and Sam seated
- **THEN** Alex and Sam each have a Reserve holding 3 face-down cards, and only one Reserve slot appears in the zone order

#### Scenario: Late joiner
- **WHEN** Kim sits down after that setup was applied
- **THEN** Kim has an empty Reserve

#### Scenario: Save records the per-seat zone
- **WHEN** the host saves a table with a per-player "Reserve" where every copy holds 3 face-down cards
- **THEN** the setup's draft has a per-seat zone "Reserve" dealing 3 face down
