# Tasks

## 1. Pin store

- [x] 1.1 Add `client/src/lib/cardPins.ts` with `loadPins(deckId)`, `savePins(deckId, pins)`, `recordSave(deckId, card, pins)` and `prefill(pins, template)`, storing under `vct.cardPins.<deckId>` (D1, D2) with try/catch fallback to in-memory storage. Verify with unit tests in `client/src/lib/cardPins.test.ts`, covering:
  - round trip through storage
  - unavailable storage
  - template keys merged with pinned rows
  - the value recorded at save time
  - the clone or other-deck key isolation

## 2. Card form

- [x] 2.1 Add pin toggles to `CardForm` for Name, Copies, Description, front, back, each property row and each ability row. Show them only for new cards, with `aria-pressed`, a 44px hit area and contrast-safe colors (D3). Initialise new-card state from `prefill`. Verify:
  - unit test: a new form with stored pins shows the pinned values
  - unit test: the edit form shows no pins
- [x] 2.2 Add "Save & add another". The parent saves, records the pins and remounts the form via a key counter. Focus goes to Name with the cursor at the end when Name is pinned, and the "Same name as the last card" hint appears when the name matches the previous one. Validation errors keep the form. Verify with unit tests for:
  - the hint
  - validation keeping the values

## 3. End-to-end and checks

- [x] 3.1 Add e2e tests in `e2e/decks.spec.ts`:
  - pin Copies, a property and Name, then add three cards with "Save & add another", and confirm the cards and their values in the list
  - reload and confirm the pins pre-fill
  - edit an existing card, confirm no pins are shown, and confirm the remembered values are unchanged
- [x] 3.2 `e2e/contrast.spec.ts` passes with the New card sheet open, including the pinned state. Full lint, unit and e2e runs are green.

## Workflow follow-up

- Push to main to deploy, verify the live version, then archive the change.
