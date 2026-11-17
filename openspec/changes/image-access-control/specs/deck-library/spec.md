# Spec Delta

## ADDED Requirements

### Requirement: Image access
The system SHALL serve an uploaded image only to its uploader, to players who can view a deck that uses it (as owner, built-in, public, or link with its share token), and to players at a table where a deck using it is loaded. Requests from anyone else SHALL be refused as not found.

#### Scenario: Private artwork stays private
- **WHEN** a player who cannot view a private deck requests one of its images
- **THEN** the server responds as if the image does not exist

#### Scenario: Table participants see loaded artwork
- **WHEN** a private deck is loaded on a table and a seated player requests one of its images
- **THEN** the image is served

### Requirement: Image requests work without headers per window
Image URLs SHALL carry a signed key identifying the requesting player, so that images display in each browser window as that window's player without cookies or request headers. A forged or tampered key SHALL be refused as not found.

#### Scenario: Two players in one browser
- **WHEN** two windows in the same browser play as different players
- **THEN** each window's images load using its own player's access

#### Scenario: Forged key
- **WHEN** an image is requested with a key that does not match its signature
- **THEN** the server responds as if the image does not exist
