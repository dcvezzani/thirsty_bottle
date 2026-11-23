# Proposal

## Why

Building a deck usually means making runs of similar cards: thirteen hearts that differ only by rank, or ten "Goblin" cards that share copies, back art and properties. Every "+ Add card" opens a blank form, and every Save closes the sheet. So the owner retypes the same values and reopens the form for each card. Duplicate helps a little, but the copy then has to be found in the list and opened.

## What Changes

- **Pins on the card form.** Every field on the "New card" form gets a pin toggle: Name, Copies, Description, front artwork, back artwork, each property row and each ability row.
  - A pinned field is pre-filled on the next new card with the value it had when the last card was saved.
  - A pinned Name opens with the cursor at the end, so a shared prefix ("Goblin ") can be extended.
- **Save & add another.** A "Save & add another" button on the "New card" sheet saves the card and keeps the sheet open on a fresh form. That form holds the pinned values, and focus is on Name.
- **Duplicate-name hint.** When a new card's name exactly matches the card just saved, a non-blocking hint ("Same name as the last card") is shown. Saving is still allowed.
- **Where pins live.** Pins and their remembered values are kept per deck in this browser. They are never part of the deck draft or a saved version, and other players never see them.
- **Scope of pins.** Pins apply only to creating new cards. Editing an existing card shows no pins and does not change them.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `deck-library`: adds requirements for remembered (pinned) fields when creating cards, and for the "Save & add another" flow in the deck editor.

## Impact

- **Client:** `client/src/pages/DeckEditor.tsx` (`CardForm` and the deck editor's new-card flow), plus a small per-deck pin store kept in browser storage.
- **No server changes:** no API, schema or migration changes. The deck draft format is unchanged.
- **Tests:** unit tests for the pin store and the form's pre-fill behavior, and e2e tests in `e2e/decks.spec.ts`.
