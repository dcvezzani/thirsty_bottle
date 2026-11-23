# deck-library Specification

## Purpose
Lets players author and manage decks of cards: artwork for card fronts and backs, how many copies of each card exist, descriptions, and arbitrary metadata. Any game, classic or invented, can then be brought to the table.

## Requirements

### Requirement: Deck creation and editing
The system SHALL let a player create, rename, describe and edit decks they own. A deck SHALL have a name, an optional description, a default back image and an ordered list of card definitions. Decks are stored in the player's library on the server and persist across sessions.

#### Scenario: Create a new deck
- **WHEN** a player creates a deck named "Standard 52"
- **THEN** an empty deck named "Standard 52" owned by that player appears in their deck library

#### Scenario: Deck persists across sessions
- **WHEN** a player saves a deck, closes the app and returns later on the same identity
- **THEN** the deck is in their library exactly as saved

### Requirement: Explicit save with draft
The deck editor SHALL keep changes as an unsaved draft until the owner saves. Saving SHALL create the deck's new current version. Discarding SHALL return the deck to its last saved version. A draft SHALL survive leaving the editor or reloading the app.

#### Scenario: Leave with unsaved changes
- **WHEN** an owner edits 3 cards, leaves the editor without saving and later reopens the deck
- **THEN** the editor offers to resume the draft or discard it, and the saved version is unchanged

#### Scenario: Others see only saved versions
- **WHEN** an owner has an unsaved draft of a public deck
- **THEN** other players, tables and clones see only the last saved version

### Requirement: Card management within a deck
The owner SHALL be able to add, edit, duplicate, reorder and remove card definitions in a deck. They SHALL be able to change the instance count of several selected cards at once, and copy card definitions from any deck they can view into a deck they own.

#### Scenario: Duplicate a card
- **WHEN** an owner duplicates the card "Knight"
- **THEN** a new card "Knight (copy)" with identical artwork, metadata, abilities and count is added after it

#### Scenario: Copy cards from another deck
- **WHEN** a player selects 4 cards in a public deck owned by someone else and copies them into their own deck
- **THEN** the 4 card definitions are added to their deck as independent copies, and the source deck is unchanged

#### Scenario: Bulk count change
- **WHEN** an owner selects 10 cards and sets their count to 2
- **THEN** all 10 cards have an instance count of 2

### Requirement: Tables use a snapshot of a saved deck
Loading a deck onto a table SHALL copy the deck's current saved version onto that table. Later edits, archiving or deletion of the deck SHALL NOT change cards on tables where it is already loaded. The host can reload the deck to pick up its newer saved version.

#### Scenario: Edit a deck while it is in play
- **WHEN** an owner saves changes to a deck that is loaded on an active table
- **THEN** the table's cards are unchanged, and the host sees that a newer version is available to reload

#### Scenario: Delete a deck in use
- **WHEN** an archived deck that is loaded on an active table is permanently deleted
- **THEN** the cards on that table remain fully playable, including artwork and card info

### Requirement: Deck archiving
An owner SHALL be able to archive an active deck and restore an archived deck. Archived decks SHALL be hidden from the main library view, from the table deck picker and from the public gallery, but stay listed under an Archived view.

#### Scenario: Archive a deck
- **WHEN** an owner archives the deck "Old Prototype"
- **THEN** it moves to the Archived view, is no longer offered when loading decks onto a table, and is withdrawn from the public gallery

#### Scenario: Restore a deck
- **WHEN** an owner restores an archived deck
- **THEN** it returns to the main library with its content, version and previous visibility setting intact

### Requirement: Only archived decks can be permanently deleted
Permanent deletion SHALL be available only for archived decks owned by the player, and SHALL require explicit confirmation. Attempts to delete an active deck SHALL be refused. Deletion SHALL NOT affect clones of the deck or table snapshots.

#### Scenario: Delete active deck refused
- **WHEN** an owner attempts to permanently delete an active deck
- **THEN** the system refuses and tells them to archive it first

#### Scenario: Delete archived deck
- **WHEN** an owner permanently deletes an archived deck and confirms
- **THEN** the deck is removed from their library for good, and existing clones of it remain intact

### Requirement: Deck visibility
Each deck SHALL have a visibility of private (the default), link (viewable by anyone with its share link), or public (also listed in the public gallery). Only the owner can change it. Archived decks SHALL NOT be viewable through links or the gallery.

#### Scenario: Share by link
- **WHEN** an owner sets a deck to link visibility and sends the link to a friend
- **THEN** the friend can open the link to browse the deck's cards and clone it, and the deck does not appear in the gallery

#### Scenario: Archived link stops working
- **WHEN** a link-visible deck is archived and someone opens its share link
- **THEN** they are told the deck is unavailable

### Requirement: Public deck gallery
The system SHALL provide a public deck gallery listing every active public deck, with name, owner, card count, a cover image, and how many times it has been cloned. Players SHALL be able to search the gallery by name or owner, preview a deck's cards, and clone it.

#### Scenario: Find and clone from gallery
- **WHEN** a player searches the gallery for "tarot" and opens a matching deck
- **THEN** they can browse its cards and clone it into their own library

### Requirement: Clone a deck
A player SHALL be able to clone any deck they can view: their own decks, the built-in decks, public or link-shared decks, and decks loaded on a table they are at. Cloning SHALL create an independent active, private deck that the player owns, with the last saved card definitions, counts, metadata, abilities and artwork. A clone of someone else's deck SHALL record its source as "Cloned from <deck> by <owner>".

#### Scenario: Clone another player's deck
- **WHEN** Sam clones Alex's public deck "Space Fleet"
- **THEN** Sam owns a new private deck "Space Fleet" that Sam can edit, and it shows "Cloned from Space Fleet by Alex"

#### Scenario: Clone is independent
- **WHEN** Alex later edits, archives or deletes "Space Fleet"
- **THEN** Sam's clone is unchanged

#### Scenario: Cannot clone a private deck
- **WHEN** a player tries to open another player's private deck that is not loaded on a table they are at
- **THEN** the system refuses as if the deck does not exist

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

### Requirement: Copy numbering on load
When a deck is loaded onto a table, each instance SHALL be assigned a copy number from 1 to N, where N is its definition's instance count, in deck order (for example "Goblin #2 of 3"). Copy numbers SHALL stay fixed for the life of the table through moves, shuffles, gathers and resets. Reloading the deck SHALL renumber its instances.

#### Scenario: Duplicates are distinguishable
- **WHEN** a deck with "Goblin" at instance count 3 is loaded onto a table
- **THEN** the three instances are numbered "Goblin #1 of 3", "#2 of 3" and "#3 of 3"

#### Scenario: Numbers survive shuffling
- **WHEN** the pile holding "Goblin #2 of 3" is shuffled and that card is later drawn and played face up
- **THEN** it is still shown as "Goblin #2 of 3"

#### Scenario: Same-named cards from two decks
- **WHEN** two loaded decks both contain a card named "Goblin"
- **THEN** each instance's card info also names the deck it came from, and each deck's copies are numbered separately

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
For backups, moving decks between servers and offline authoring, the system SHALL export any deck the player can view as a single archive containing a JSON manifest and its images. It SHALL import such an archive, or a JSON manifest alone that references image URLs, as a new private deck owned by the importer, and report validation errors per card.

#### Scenario: Round-trip export
- **WHEN** a player exports a deck and imports the resulting file
- **THEN** a new deck is created with identical card definitions, counts, metadata and artwork

#### Scenario: Invalid manifest entry
- **WHEN** an imported manifest contains a card with a negative instance count
- **THEN** the import reports that card's error and does not create the deck

### Requirement: Built-in starter deck
The system SHALL provide a read-only standard 52-card deck with optional jokers, which players can use on tables or clone into their own library.

#### Scenario: Use starter deck
- **WHEN** a host loads the built-in standard deck onto a table
- **THEN** 52 cards with `suit` and `rank` metadata are placed in a single face-down pile

### Requirement: Deck sharing to tables
A host SHALL be able to load onto their table any active deck they own, any built-in deck, and any public or link-shared deck. Participants at that table SHALL be able to browse the loaded deck's card definitions and clone it, but not edit it.

#### Scenario: Non-owner cannot edit
- **WHEN** a seated player who does not own the loaded deck opens it from the table
- **THEN** they can browse its card definitions and clone it, but editing controls are unavailable

### Requirement: Report a public deck
Any player who can view a public deck that is not built in SHALL be able to report it, with an optional reason. A report SHALL hide the deck from the public gallery until an admin reviews it. Reporting the same deck again by the same player SHALL have no additional effect.

#### Scenario: Report hides from the gallery
- **WHEN** a player reports a public deck
- **THEN** the deck no longer appears in gallery searches, and its owner still sees it in their library

#### Scenario: Built-in decks cannot be hidden
- **WHEN** a player reports a built-in deck
- **THEN** the built-in deck stays available to everyone

### Requirement: Admin review of reports
A server operator SHALL be able to list reported decks with report counts and reasons, unhide a deck (which clears its reports and returns it to the gallery), or hide a deck, using a command-line tool run against the server's data directory.

#### Scenario: Unhide after review
- **WHEN** the operator runs the unhide command for a reported public deck
- **THEN** the deck appears in the gallery again and its reports are cleared

#### Scenario: List reports
- **WHEN** the operator runs the reports command
- **THEN** each reported deck is listed with its name, number of reports and reasons

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

### Requirement: Image requests work without headers per window
Image URLs SHALL carry a signed key identifying the requesting player, so that images display in each browser window as that window's player without cookies or request headers. A forged or tampered key SHALL be refused as not found.

#### Scenario: Two players in one browser
- **WHEN** two windows in the same browser play as different players
- **THEN** each window's images load using its own player's access

#### Scenario: Forged key
- **WHEN** an image is requested with a key that does not match its signature
- **THEN** the server responds as if the image does not exist

### Requirement: Prune unreferenced old versions
The system SHALL periodically delete saved deck versions that are older than 30 days and are neither a deck's current version nor referenced by any table snapshot. Pruning SHALL NOT affect current versions, unsaved drafts or decks loaded on tables. Images used only by pruned versions SHALL then become eligible for garbage collection.

#### Scenario: Old superseded version
- **WHEN** a deck has been saved several times and its first version is 40 days old and not loaded on any table
- **THEN** that version is deleted, and the current version and draft are unchanged

#### Scenario: Version in use on a table
- **WHEN** a 40-day-old version is loaded on an open table
- **THEN** it is kept and the table keeps working

### Requirement: Remembered fields when creating cards
When creating a new card in the deck editor, the owner SHALL be able to pin any field: name, copies, description, front artwork, back artwork, each property row (key, type and value) and each ability row. When the owner starts another new card, every pinned field SHALL be pre-filled with the value it had when the previous new card was saved. Unpinned fields SHALL start empty, or with the deck's property template keys and blank values, as before.

#### Scenario: Pinned values carry over
- **WHEN** the owner pins Copies (3) and the property "suit" (hearts), saves the card, and starts another new card
- **THEN** the new form shows Copies 3 and suit "hearts", and the unpinned fields are empty

#### Scenario: Pinned value follows the last save
- **WHEN** the owner changes the pinned "suit" to "spades" on a new card and saves it
- **THEN** the next new card is pre-filled with "spades"

#### Scenario: Pinned name prefix
- **WHEN** the owner pins Name, saves a card named "Goblin ", and starts another new card
- **THEN** the name field is pre-filled with "Goblin ", focused, and has the cursor at its end

### Requirement: Pins stay with the owner's browser
Pins and remembered values SHALL be kept per deck in the owner's browser. They SHALL persist across reloads, SHALL NOT be stored in the deck draft or any saved deck version, and SHALL NOT be visible to other players. Pins SHALL apply only when creating new cards. Editing an existing card SHALL NOT show pins or change remembered values.

#### Scenario: Pins survive a reload
- **WHEN** the owner pins fields, saves a new card, reloads the deck editor, and starts another new card
- **THEN** the pinned fields are pre-filled

#### Scenario: Editing leaves pins alone
- **WHEN** the owner edits an existing card and saves it
- **THEN** no pin controls are shown, and the next new card is pre-filled with the values remembered before the edit

#### Scenario: Pins are not shared
- **WHEN** another player views or clones the deck
- **THEN** the card definitions are unchanged by pinning, and that player's new-card form shows none of the owner's pins

### Requirement: Save and add another card
The new-card form SHALL offer "Save & add another" alongside Save. It SHALL save the card and keep the sheet open on a fresh new-card form, with pinned values filled in and focus on the name field. If the name entered matches the name of the card just saved, the form SHALL show a non-blocking hint and SHALL still allow saving.

#### Scenario: Add a run of cards without closing the sheet
- **WHEN** the owner fills in a new card and taps "Save & add another" three times with different names
- **THEN** three cards are added to the deck, and the "New card" sheet is still open

#### Scenario: Same name is allowed with a hint
- **WHEN** the owner saves a card named "Goblin" with "Save & add another" and the next form's name is also "Goblin"
- **THEN** the hint "Same name as the last card" is shown, and saving adds a second card named "Goblin"

#### Scenario: Validation errors keep the form
- **WHEN** the owner taps "Save & add another" with an empty name
- **THEN** no card is added, the error is shown, and the form keeps its values
