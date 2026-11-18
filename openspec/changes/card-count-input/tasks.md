# Tasks

## 1. Count control

- [ ] 1.1 Add `client/src/components/CountField.tsx` and `.count-field` styles (design D1, D2, D4). Verify with unit tests in `client/src/components/CountField.test.tsx`:
  - clearing and typing `12` keeps `12` and reports 12
  - an empty draft reports `null`
  - `99` clamps to max on blur and `0` to min
  - a slider change updates the number
  - lowering `max` below the value clamps it

## 2. Use it in the table sheets

- [ ] 2.1 Replace the Draw and Deal count inputs in `client/src/table/Sheets.tsx`, with bounds per design D3. The action buttons are disabled while the count is `null`, and the Deal maximum follows the selected seats. Verify with e2e tests in `e2e/count-field.spec.ts`:
  - on a phone viewport, clearing the Draw count and typing 12 draws 12 cards
  - dealing with the slider (arrow keys on the focused range) gives each seat the chosen count
  - deselecting a seat lowers the maximum
- [ ] 2.2 Replace the Peek count and Cut depth inputs in the Zone sheet. Verify with an e2e test: peeking 3 marks 3 cards as peeked, and cut depth clamps to pile minus 1.

## 3. Layout and regression checks

- [ ] 3.1 Add an e2e assertion that the `.count-field` row is no taller than 44px and no wider than its container, at 375px and 1280px. Verify that `e2e/contrast.spec.ts` and the existing table e2e tests still pass (full `npm run test:e2e`).

## Workflow follow-up

- Archive after CI is green on `main` and the auto-deploy has succeeded.
