# Spec Delta

## Purpose

Lets any player inspect a card's full details (artwork, name, description, metadata and ability fields) while never revealing information about cards that are hidden from them.

## ADDED Requirements

### Requirement: Open card info
Any participant SHALL be able to open a details view for any card instance whose face they are currently allowed to see. The view shows the front artwork at full size, name, description, all metadata properties and all ability entries.

#### Scenario: Inspect a face-up card
- **WHEN** a player long-presses (touch) or right-clicks (pointer) a face-up card on the table
- **THEN** a details view opens showing the card's artwork, name, description, metadata and abilities

### Requirement: Hidden cards reveal no identity
For a card whose face the viewer cannot see, the details view SHALL show only the back artwork and non-identifying facts: which zone it is in, its position, and who holds it.

#### Scenario: Inspect a face-down card
- **WHEN** a player opens info on a face-down card in the draw pile
- **THEN** the view shows the back image and "Draw pile, card 7 of 40" and shows no name, description or metadata

#### Scenario: Inspect an opponent's hand card
- **WHEN** a player opens info on a card in another player's hand that has not been shown to them
- **THEN** the view shows only the back image and the holder's name

### Requirement: Card definition reference
Participants SHALL be able to browse the full list of card definitions for every deck loaded on the table, without learning where any specific instance is located.

#### Scenario: Browse deck reference
- **WHEN** a player opens the deck reference for the loaded deck
- **THEN** they see each definition with its artwork, metadata and instance count, and no current locations are shown

### Requirement: Zoom from hand
A player SHALL be able to enlarge a card in their own hand to full-screen artwork with one gesture, without leaving the table.

#### Scenario: Hover enlarge
- **WHEN** a player hovers (pointer) or presses and holds (touch) a card in their hand
- **THEN** the card is shown enlarged above the hand until released
