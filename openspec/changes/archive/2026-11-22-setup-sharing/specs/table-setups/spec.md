## MODIFIED Requirements

### Requirement: Setup library
Each player SHALL have a library of setups with the same lifecycle as decks: create, edit with draft and save, clone, archive, and delete only when archived. Archived setups SHALL NOT be offered when applying. A table SHALL keep working when the setup it used is archived or deleted; Play again SHALL then explain that the setup is no longer available.

#### Scenario: Clone a setup
- **WHEN** a player clones their "Klondike" setup
- **THEN** a new setup "Klondike (copy)" appears in their library, editable independently, as cloning one's own deck does

#### Scenario: Delete only when archived
- **WHEN** a player tries to delete an active setup
- **THEN** deleting is not offered until the setup is archived

### Requirement: Applying a setup
A setup SHALL be applicable when creating a table, with Apply setup in the table settings, and with Play again, which reapplies the table's last setup. The host SHALL be able to apply any active setup they can view: their own, a built-in setup, or a public or link-shared setup. Applying SHALL replace the table's zones, cards and counters, and SHALL keep seats, players, chat, the log and table settings. On an existing table the host SHALL be asked to confirm. Applying SHALL be one action with one log entry, undoable once within the usual undo window. Only the host SHALL be able to apply a setup.

#### Scenario: Create a table from a setup
- **WHEN** a host creates a table and chooses the Klondike setup
- **THEN** the table opens with the setup's zones in order, the cards dealt, and its counters

#### Scenario: Play again
- **WHEN** the host taps Play again on a table last set up with Hearts and confirms
- **THEN** the zones, cards and counters are replaced by a fresh Hearts setup, every player keeps their seat, and the log records it

#### Scenario: Undo an apply
- **WHEN** the host applies a setup to an existing table and presses undo within 10 seconds, before anyone else acts
- **THEN** the table returns to its previous zones, cards and counters

#### Scenario: Apply another player's public setup
- **WHEN** Sam hosts a table and applies Alex's public setup "Rummy" from the gallery
- **THEN** Sam's table is set up with "Rummy"

## ADDED Requirements

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
