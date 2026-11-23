## MODIFIED Requirements

### Requirement: Image access
The system SHALL serve an uploaded image only to its uploader, to players whose image library holds it, to players who can view a deck that uses it (as owner, built-in, public, or link with its share token), and to players at a table where a deck using it is loaded. Requests from anyone else SHALL be refused as not found.

#### Scenario: Private artwork stays private
- **WHEN** a player who cannot view a private deck requests one of its images
- **THEN** the server responds as if the image does not exist

#### Scenario: Table participants see loaded artwork
- **WHEN** a private deck is loaded on a table and a seated player requests one of its images
- **THEN** the image is served

#### Scenario: Same artwork imported by two players
- **WHEN** two players each import the same picture into their libraries
- **THEN** each of them can fetch it, though it is stored once
