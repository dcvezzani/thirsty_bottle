# Spec Delta

## Purpose

Lets players author and manage decks of cards: artwork for card fronts and backs, how many copies of each card exist, descriptions, and arbitrary metadata. Any game, classic or invented, can then be brought to the table.

## ADDED Requirements

### Requirement: Deck creation and editing
The system SHALL let a player create, rename, describe, duplicate and delete decks they own. A deck SHALL have a name, an optional description, a default back image and an ordered list of card definitions.

#### Scenario: Create a new deck
- **WHEN** a player creates a deck named "Standard 52"
- **THEN** an empty deck named "Standard 52" owned by that player appears in their deck library

#### Scenario: Delete a deck in use
- **WHEN** a player deletes a deck that is currently loaded on an active table
- **THEN** the deck is removed from the library and the cards already on that table remain playable until the table is reset

### Requirement: Card definitions
Each card definition SHALL have a name, an optional description, a front image, an optional back image (falling back to the deck's default back) and an instance count of at least 1.

#### Scenario: Card uses deck default back
- **WHEN** a card definition has no back image
- **THEN** its instances display the deck's default back image when face down

#### Scenario: Reject zero instances
- **WHEN** a player sets a card's instance count to 0
- **THEN** the system rejects the change and keeps the previous count

### Requirement: Instance counts produce physical copies
When a deck is loaded onto a table, the system SHALL create one distinct card instance per unit of each definition's instance count.

#### Scenario: Multiple copies
- **WHEN** a deck containing a definition "Goblin" with instance count 3 is loaded onto a table
- **THEN** the table contains 3 separate "Goblin" card instances that can be moved independently

### Requirement: Flexible card metadata
Card definitions SHALL support an open set of metadata properties. Each property has a key and a value of type text, number, boolean or list of text. Decks SHALL be able to declare suggested property keys that their cards share.

#### Scenario: Add custom property
- **WHEN** a player adds the property `suit = "Hearts"` and `rank = 12` to a card
- **THEN** the card stores both properties with their types and shows them in card info

#### Scenario: Deck-level property template
- **WHEN** a deck declares suggested keys `suit` and `rank`
- **THEN** the card editor offers those keys for every card in that deck, and cards may still add other keys

### Requirement: Descriptive ability fields
Card definitions SHALL optionally hold structured ability entries, each with trigger, effect type, effect value and targeting fields. The system SHALL display these entries and SHALL NOT execute them automatically.

#### Scenario: Ability is informational
- **WHEN** a card with ability `{trigger: "On Play", effect: "Draw Card", value: 2, target: "Self"}` is moved to the table
- **THEN** the ability appears in the card's info and no cards are drawn automatically

### Requirement: Artwork upload and normalization
The system SHALL accept PNG, JPEG and WebP uploads up to 10 MB for card fronts and backs. It SHALL store each image normalized to a 2.5:3.5 aspect ratio at 750×1050 pixels, plus a smaller thumbnail.

#### Scenario: Upload off-ratio image
- **WHEN** a player uploads a 1000×1000 image as a card front
- **THEN** the system fits the image into a 750×1050 card frame without distortion and shows a preview before saving

#### Scenario: Reject unsupported file
- **WHEN** a player uploads a 30 MB TIFF file
- **THEN** the system rejects the upload with a message that names the allowed formats and size limit

### Requirement: Cards without artwork
The system SHALL render a card that has no front image as a generated face showing the card's name and key metadata. Text-only decks are therefore playable.

#### Scenario: Text-only card
- **WHEN** a card definition named "Ace of Spades" has no front image
- **THEN** its face shows "Ace of Spades" in a standard card frame

### Requirement: Deck import and export
The system SHALL export a deck as a single archive containing a JSON manifest and its images. It SHALL import such an archive, or a JSON manifest alone that references image URLs, and report validation errors per card.

#### Scenario: Round-trip export
- **WHEN** a player exports a deck and imports the resulting file
- **THEN** a new deck is created with identical card definitions, counts, metadata and artwork

#### Scenario: Invalid manifest entry
- **WHEN** an imported manifest contains a card with a negative instance count
- **THEN** the import reports that card's error and does not create the deck

### Requirement: Built-in starter deck
The system SHALL provide a read-only standard 52-card deck with optional jokers, which players can use on tables or duplicate into their own library.

#### Scenario: Use starter deck
- **WHEN** a host loads the built-in standard deck onto a table
- **THEN** 52 cards with `suit` and `rank` metadata are placed in a single face-down pile

### Requirement: Deck sharing to tables
A deck owner SHALL be able to load any of their decks onto a table they host. Players at that table SHALL be able to see the deck's card definitions without being able to edit them.

#### Scenario: Non-owner cannot edit
- **WHEN** a seated player who does not own the loaded deck opens it from the table
- **THEN** they can browse its card definitions but editing controls are unavailable
