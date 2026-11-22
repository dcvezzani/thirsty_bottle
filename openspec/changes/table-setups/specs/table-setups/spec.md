## Purpose

Lets hosts record how a table is set up for a game (zones, decks, the deal and counters) and apply that setup in one step for however many players are seated, with setups managed like decks.

## ADDED Requirements

### Requirement: Save table as setup
The host SHALL be able to save the current table as a setup. The setup SHALL record the shared zones in order with their name, layout, width, new row and color; each loaded deck as a deck slot; how many cards each zone holds face down and face up; and the counters with their values. Equal hand sizes SHALL become a per-seat hand of that size, and a counter whose label starts with a seated player's name SHALL become a per-seat counter. The result SHALL open as a draft in the setup editor.

#### Scenario: Record a Klondike table
- **WHEN** the host has Stock, Waste, F1 to F4 and P1 to P7 set up with P3 holding 2 face-down cards and 1 face-up card, and saves the table as a setup
- **THEN** the setup's draft lists the 13 zones in order, with P3 set to deal 2 face down and 1 face up

#### Scenario: Per-seat elements are recognized
- **WHEN** the host saves a table where Alex and Sam each hold 7 cards and there are counters "Alex score" and "Sam score"
- **THEN** the draft has a per-seat hand of 7 and a per-seat counter "{name} score"

### Requirement: Setup editing and versions
A player SHALL be able to create a setup from scratch or edit one they own. Edits SHALL be kept as a draft until saved, and each save SHALL create a new version. The editor SHALL cover the player range, deck slots, zones with their deal, per-seat elements, counters, counts by player count and the fixed-deal option.

#### Scenario: Draft until saved
- **WHEN** the owner changes a zone's deal in the editor and leaves without saving
- **THEN** applying the setup still uses the last saved version, and the draft is still there when the editor is reopened

### Requirement: Card distribution
By default a setup SHALL record and deal card counts and faces only, shuffling its decks before every deal, so each apply produces a new deal. A setup MAY opt in to a fixed deal, which records exactly which cards are in each zone and hand, in order and with their faces, and recreates that arrangement for the player count it was recorded with.

#### Scenario: A fresh deal every time
- **WHEN** a counts-and-faces setup is applied twice
- **THEN** each zone gets the same number of cards with the same faces both times, generally different cards

#### Scenario: Fixed deal
- **WHEN** a setup with a fixed deal recorded for 2 players is applied with 2 players seated
- **THEN** every zone and hand receives exactly the recorded cards, in the recorded order and faces

### Requirement: Deck slots
Each deck in a setup SHALL be a slot with a default deck. When applying, the host SHALL be able to keep the defaults or choose another deck for any slot. A slot used by a fixed deal SHALL be locked to the exact deck version it was recorded from. If the chosen decks cannot provide the cards the deal needs, applying SHALL be refused with an explanation and nothing on the table SHALL change.

#### Scenario: Swap a deck
- **WHEN** the host applies a Klondike setup and chooses a different 52-card deck for its slot
- **THEN** the table is set up with that deck's cards

#### Scenario: Not enough cards
- **WHEN** the host chooses a 20-card deck for a slot whose deal needs 28 cards
- **THEN** applying is refused, saying the deck has too few cards, and the table is unchanged

### Requirement: Player counts
A setup SHALL support per-seat elements: a hand of N cards, a zone, or a counter created for every seated player, with `{name}` replaced by that player's name. Any card count SHALL be able to vary with the number of players, including "all remaining" cards. A setup SHALL have a player range, and applying outside it SHALL be refused. The players are those seated when the setup is applied.

#### Scenario: Per-seat counters and hands
- **WHEN** a setup with a per-seat hand of 7 and a per-seat counter "{name} score" starting at 0 is applied with Alex, Sam and Kim seated
- **THEN** each of them holds 7 cards, and counters "Alex score", "Sam score" and "Kim score" exist at 0

#### Scenario: Counts by player count
- **WHEN** a setup deals hands of 10 for 2 players and 7 for 3 or 4 players, and is applied with 3 players seated
- **THEN** each player receives 7 cards

#### Scenario: Deal all remaining
- **WHEN** a setup deals all remaining cards of a 52-card deck to the hands of 3 players
- **THEN** the first seat in deal order receives 18 cards and the others 17

#### Scenario: Outside the player range
- **WHEN** a setup for 2 to 4 players is applied with 5 players seated
- **THEN** applying is refused, saying the setup is for 2 to 4 players

### Requirement: Applying a setup
A setup SHALL be applicable when creating a table, with Apply setup in the table settings, and with Play again, which reapplies the table's last setup. Applying SHALL replace the table's zones, cards and counters, and SHALL keep seats, players, chat, the log and table settings. On an existing table the host SHALL be asked to confirm. Applying SHALL be one action with one log entry, undoable once within the usual undo window. Only the host SHALL be able to apply a setup.

#### Scenario: Create a table from a setup
- **WHEN** a host creates a table and chooses the Klondike setup
- **THEN** the table opens with the setup's zones in order, the cards dealt, and its counters

#### Scenario: Play again
- **WHEN** the host taps Play again on a table last set up with Hearts and confirms
- **THEN** the zones, cards and counters are replaced by a fresh Hearts setup, every player keeps their seat, and the log records it

#### Scenario: Undo an apply
- **WHEN** the host applies a setup to an existing table and presses undo within 10 seconds, before anyone else acts
- **THEN** the table returns to its previous zones, cards and counters

### Requirement: Setup library
Each player SHALL have a private library of setups with the same lifecycle as decks: create, edit with draft and save, clone (including setups shared with them in a later change), archive, and delete only when archived. Archived setups SHALL NOT be offered when applying. A table SHALL keep working when the setup it used is archived or deleted; Play again SHALL then explain that the setup is no longer available.

#### Scenario: Clone a setup
- **WHEN** a player clones their "Klondike" setup
- **THEN** a new setup "Copy of Klondike" appears in their library, editable independently

#### Scenario: Delete only when archived
- **WHEN** a player tries to delete an active setup
- **THEN** deleting is not offered until the setup is archived
