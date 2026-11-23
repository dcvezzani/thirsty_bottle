# table-setups Specification

## Purpose
Lets hosts record how a table is set up for a game (zones, decks, the deal and counters) and apply that setup in one step for however many players are seated, with setups managed like decks.

## Requirements

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

### Requirement: Which setups a host can apply
The host SHALL be able to apply any active setup they can view: their own, a built-in setup, or a public or link-shared setup. Play again SHALL reuse the deck chosen for each slot the last time the setup was applied.

#### Scenario: Apply another player's public setup
- **WHEN** Sam hosts a table and applies Alex's public setup "Rummy" from the gallery
- **THEN** Sam's table is set up with "Rummy"

#### Scenario: Play again keeps the chosen decks
- **WHEN** Sam applied Alex's setup choosing his own deck for a slot, and later taps Play again
- **THEN** the setup is applied again with the same deck, without asking

### Requirement: Setup library
Each player SHALL have a library of setups with the same lifecycle as decks: create, edit with draft and save, clone, archive, and delete only when archived. Archived setups SHALL NOT be offered when applying. A table SHALL keep working when the setup it used is archived or deleted; Play again SHALL then explain that the setup is no longer available.

#### Scenario: Clone a setup
- **WHEN** a player clones their "Klondike" setup
- **THEN** a new setup "Klondike (copy)" appears in their library, editable independently, as cloning one's own deck does

#### Scenario: Delete only when archived
- **WHEN** a player tries to delete an active setup
- **THEN** deleting is not offered until the setup is archived

### Requirement: Setup visibility
Each setup SHALL have a visibility of private (the default), link (viewable by anyone with its share link), or public (also listed in the setup gallery). Only the owner can change it. Archived setups SHALL NOT be viewable through links or the gallery. When the owner makes a setup link or public while a slot's default deck is one other players cannot use, the owner SHALL be warned.

#### Scenario: Share by link
- **WHEN** an owner sets a setup to link visibility and sends the link to a friend
- **THEN** the friend can open the link to view the setup and clone it, and the setup does not appear in the gallery

#### Scenario: Archived link stops working
- **WHEN** a link-visible setup is archived and someone opens its share link
- **THEN** they are told the setup is unavailable

#### Scenario: Warning about a private default deck
- **WHEN** an owner makes a setup public while its deck slot defaults to their private deck
- **THEN** they are warned that other players will need to choose their own deck for that slot

### Requirement: Setup gallery
The system SHALL provide a setup gallery listing every active public setup that is not hidden, with its name, owner, player range, zone count and how many times it has been cloned. Players SHALL be able to search it by name or owner, sort it by newest or most cloned, open a setup to view it read-only, and clone it.

#### Scenario: Find and clone from the gallery
- **WHEN** a player searches the setup gallery for "rummy" and opens a matching setup
- **THEN** they can view its zones, decks, deal and counters, and clone it into their own library

### Requirement: Cloning others' setups
A player SHALL be able to clone any setup they can view: their own, built-in setups, and public or link-shared setups. A clone SHALL be an independent private setup the player owns, with the last saved content. A clone of someone else's setup SHALL record its source as "Cloned from <setup> by <owner>". Cloning a private setup of another player SHALL be refused as if it did not exist.

#### Scenario: Clone another player's setup
- **WHEN** Sam clones Alex's public setup "Rummy"
- **THEN** Sam owns a new private setup "Rummy" that Sam can edit, showing "Cloned from Rummy by Alex", and Alex's setup shows one more clone

#### Scenario: Cannot view a private setup
- **WHEN** a player tries to open another player's private setup
- **THEN** the system refuses as if the setup does not exist

### Requirement: Default decks the host cannot use
When a host applies a setup whose slot defaults to a deck the host cannot use, that slot SHALL require the host to choose another deck. A fixed deal whose locked deck the host cannot use SHALL be refused, explaining that the setup's fixed deal needs its owner's deck.

#### Scenario: Choose your own deck
- **WHEN** Sam applies Alex's public setup whose slot defaults to Alex's private deck
- **THEN** Sam is asked to choose a deck for that slot, and the setup applies with the deck Sam chooses

### Requirement: Built-in setups
The system SHALL provide read-only built-in setups that every player can apply and clone, using the built-in Standard 52 deck: Klondike for 1 player, Hearts for 3 to 6 players dealing all cards, and Crazy Eights for 2 to 7 players dealing 7 cards each to 2 players and 5 each otherwise, with one card face up starting the discard pile.

#### Scenario: Play Klondike from the built-ins
- **WHEN** a host alone at a table applies the built-in Klondike setup
- **THEN** the table has a stock, a waste pile, four foundations and seven columns holding 1 to 7 cards with the last card face up

#### Scenario: Crazy Eights for three
- **WHEN** a host with 3 seated players applies the built-in Crazy Eights setup
- **THEN** each player holds 5 cards, the discard pile shows one face-up card, and the rest form the stock

### Requirement: Report a public setup
Any player who can view a public setup that is not built in SHALL be able to report it, with an optional reason. A report SHALL hide the setup from the gallery until an operator reviews it. Reporting the same setup again by the same player SHALL have no additional effect.

#### Scenario: Report hides from the gallery
- **WHEN** a player reports a public setup
- **THEN** the setup no longer appears in gallery searches, and its owner still sees it in their library

#### Scenario: Built-in setups cannot be hidden
- **WHEN** a player reports a built-in setup
- **THEN** the built-in setup stays available to everyone

### Requirement: Admin review of setup reports
A server operator SHALL be able to list reported setups with report counts and reasons, unhide a setup (which clears its reports and returns it to the gallery), or hide a setup, using the same command-line tool as for decks.

#### Scenario: Unhide after review
- **WHEN** the operator runs the unhide command for a reported public setup
- **THEN** the setup appears in the gallery again and its reports are cleared

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
