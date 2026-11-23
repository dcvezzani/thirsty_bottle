## Purpose

A player's private image library: images imported ahead of time (singly or in bulk), named, kept until deleted, and chosen when setting card fronts, card backs and deck backs, or to create cards directly.

## ADDED Requirements

### Requirement: Personal image library
Each player SHALL have a private image library. Every image the player imports or uploads SHALL be added to it with a name, which defaults to the file name without its extension. A player SHALL be able to rename their library images. A player's library SHALL be visible only to that player. Images in any player's library SHALL NOT be removed by automatic image cleanup.

#### Scenario: Upload joins the library
- **WHEN** a player uploads "goblin-archer.png" as a card front
- **THEN** the image appears in their library named "goblin-archer"

#### Scenario: Unused library image is kept
- **WHEN** a library image is used by no deck for more than a day
- **THEN** it is still in the library and can still be fetched by its owner

#### Scenario: Library is private
- **WHEN** another player lists images
- **THEN** they see only their own library, never this player's

#### Scenario: Rename
- **WHEN** the player renames "goblin-archer" to "Goblin Archer"
- **THEN** the library and its search show the new name

### Requirement: Importing several images at once
A player SHALL be able to choose several image files in one action to import into their library. Each file SHALL be checked and normalised with the same rules as single uploads. The system SHALL show progress per file. A file that fails SHALL be listed with its reason, and the other files SHALL still import. Importing an image already in the library SHALL NOT create a duplicate.

#### Scenario: Bulk import with one bad file
- **WHEN** a player imports 12 files and one is a 15 MB image
- **THEN** 11 images join the library, and the oversized file is reported with the upload rules

#### Scenario: Re-import is not duplicated
- **WHEN** a player imports a file whose image is already in their library
- **THEN** the library still has one entry for it

### Requirement: Browsing the library
The library SHALL be available from the deck editor and on its own Images page. It SHALL show each image as a thumbnail with its name and how many cards and deck backs use it. It SHALL be searchable by name. In the deck editor, it SHALL offer a "This deck" view (images the open deck uses) and an "All" view.

#### Scenario: Deck view and all images
- **WHEN** the owner opens the Images section of a deck that uses 3 of their 20 library images
- **THEN** "This deck" shows 3 images and "All" shows 20

#### Scenario: Search
- **WHEN** the player types "gob" in the library search
- **THEN** only images whose names contain "gob" are shown, ignoring case

### Requirement: Choosing artwork from the library
Wherever a card front, card back or deck back image is set, the player SHALL be able to choose an image from their library in addition to uploading a new one. Uploading with a preview, and removing an image, SHALL keep working as before.

#### Scenario: Set a front from the library
- **WHEN** the player chooses "Choose from images..." on a card's front and taps "goblin-archer"
- **THEN** the card's front is that image, and it shows in the form without another upload

#### Scenario: Upload still works
- **WHEN** the player uses "Choose front...", previews a file and accepts it
- **THEN** the card's front is set, as before, and the image is also in the library

#### Scenario: Deck back from the library
- **WHEN** the owner sets the deck back image from the library in deck settings
- **THEN** cards without their own back use it

### Requirement: Creating cards from images
From the library in the deck editor, the owner SHALL be able to select several images and create one card per image in the open deck. Each card SHALL be named after its image, SHALL use the image as its front, and SHALL take its other fields from the deck's remembered new-card values where those are pinned (otherwise copies 1 and the property template). The cards SHALL be added to the deck draft in the order selected.

#### Scenario: A deck from a folder
- **WHEN** the owner selects 12 library images and taps "Create 12 cards"
- **THEN** 12 cards are added, each named after its image and showing it as the front

#### Scenario: Pinned values apply
- **WHEN** the owner has pinned Copies 2 and back artwork, then creates cards from 3 images
- **THEN** each new card has 2 copies and the pinned back

### Requirement: Deleting library images
A player SHALL be able to delete a library image only when no deck version, deck draft or loaded table uses it. For an image in use, the library SHALL show where it is used and SHALL NOT delete it. Deleting SHALL remove it from the library and allow automatic cleanup to remove the file.

#### Scenario: Unused image deleted
- **WHEN** the player deletes a library image no deck uses
- **THEN** it disappears from the library

#### Scenario: Used image protected
- **WHEN** the player tries to delete an image used by 3 cards in 2 decks
- **THEN** it is not deleted, and the library says it is used by 3 cards in 2 decks

### Requirement: Existing images join libraries
When this feature is introduced, each player's library SHALL be populated with the images they uploaded and the images used by decks they own. Each SHALL be named after a card that uses it plus its role, such as "Cruiser (front)" or "Deck back", or "Image" when unused.

#### Scenario: Backfill
- **WHEN** a player who already has a deck with a card "Cruiser" with front art opens their library
- **THEN** the library contains that image named "Cruiser (front)"
