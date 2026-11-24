# Tasks

## 1. Chip and sheet

- [x] 1.1 Make the seat chip one line: crown, name with ellipsis, mini back and hand count. Remove the per-zone count lines, the viewing line, the status text and the shown thumbnails. Keep the turn, drop and empty styling, plus an `.away` dim. Build the full accessible name: name, host, disconnected, viewing, hand count (D1, D2). Verify with an e2e test (in 2.1) that a chip with seven per-player zones is one line tall (at most 44 px plus padding) at 375 px.
- [x] 1.2 Seat sheet: add a status line (host, disconnected, viewing Sam or viewing you) and a "Shown to you" row. Keep the per-player zone sections with their counts (D3). Verify with the e2e tests in 2.1.
- [x] 1.3 Label my own per-player copy with the zone name in `zoneLabel` (D4). Verify with a unit test in `client/src/table/views.test.ts` covering own, other and empty-seat labels.

## 2. Tests and checks

- [x] 2.1 Update the e2e tests:
  - in `per-player-zones` and `player-views`, read counts and "viewing" from the seat sheet or the accessible name, and use "Tableau" labels instead of "Your Tableau"
  - add a compact-chip test: seven per-player zones and a disconnected player, the chip height stays one line, and the sheet lists the zones and status
- [x] 2.2 Update `e2e/contrast.spec.ts` for the dimmed away chip and the seat sheet status line. Full lint, unit and e2e runs are green.

## Workflow follow-up

- Push to main to deploy, verify the live version, then archive the change.
