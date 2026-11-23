## ADDED Requirements

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
