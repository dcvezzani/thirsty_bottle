# Tasks

## 1. Preference and state

- [x] 1.1 Add `lib/loupePrefs.ts` (stored mode with the touch-point default and an in-memory fallback), `useUI.loupeFace`, `loupe.peek` and `useUI.viewed`, and the pure dismissal rule `endsViewing(event, state)` (D1, D2, D4). Verify with unit tests: the default for two touch points, one touch point and none; storage round trip and a blocked-storage fallback; the face and the peek combine as specified; each dismissal event ends a viewing and a pan or scroll does not.

## 2. Second finger

- [x] 2.1 Make the loupe take touches during a scrub in "second-finger" mode and flip `loupeFace` on a quick tap of a second finger, ignoring a held or moving one; keep the scrub going (D3). Verify with an e2e test using two CDP touches: scrub with one, tap the loupe with another, the loupe shows details and the next card's details too, tap again for the card; a second finger that holds does not switch; a second finger on the board outside the loupe is still a pan; release removes the loupe.

## 3. Stay open

- [x] 3.1 Keep the loupe and mark the card viewed on release in "stay" mode, with the toggle and close buttons, the viewed outline, and every way of ending the viewing (D4, D5). Verify with an e2e test: scrub and release, the loupe and outline stay, nothing is selected, the toggle switches views; each ending (close button, Escape, a new scrub, a selecting tap, a tap on the viewed card, a tap on the felt, opening a sheet) closes it; scrolling the board does not.

## 4. Setting and checks

- [x] 4.1 Add the "Card loupe" choice to the table settings ("On this device") and verify the mode follows it after a reload (D1). Update the contrast checks for the loupe controls and the viewed outline in light and dark, and run lint, unit and e2e suites in full.

## Workflow follow-up

- Push to main to deploy, verify the live version, then archive the change.
