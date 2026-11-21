## ADDED Requirements

### Requirement: Zone card count
Every shared zone's label SHALL show how many cards the zone holds. The count SHALL stay fully visible however narrow the zone is; when the label does not fit, the zone's name SHALL be shortened instead.

#### Scenario: Narrow pile with a long name
- **WHEN** a fit-width pile named "Standard 52" holds 27 cards on a 375-pixel phone
- **THEN** its label shows the full count "27", with the name shortened

#### Scenario: Seven columns on a phone
- **WHEN** seven column zones named "Tableau 1" to "Tableau 7" share a row on a 375-pixel phone and "Tableau 3" holds 12 cards
- **THEN** each label shows its full count, and "Tableau 3" shows "12"

#### Scenario: Empty zone bar
- **WHEN** an empty zone is shown as a slim bar
- **THEN** its label shows the count 0 in full
