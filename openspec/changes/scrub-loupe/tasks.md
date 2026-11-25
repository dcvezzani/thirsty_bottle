# Tasks

## 1. Pure logic

- [ ] 1.1 Add the dwell event to `ZoneGesture` (a still finger for `dwellMs` during a scrub or drag fires once per card and re-arms on movement) and a pure `strip.ts` (reading order of the board's zones, skipping empty ones; card to position and back; next and previous with row wrap) (D2, D3). Verify with unit tests: dwell fires once after 300 ms, not when moving, again after moving to another card; strip order across rows, empty zones skipped, wrap forwards and backwards, a one-zone board.

## 2. Loupe

- [ ] 2.1 Add the `Loupe` overlay (large card, details on dwell, zone and row names, hidden cards as backs), the press-time side rule, and wire it to scrub previews in rows, columns and the dock (D1, D7, D8). Verify with component tests for the side rule (top by default, bottom in the upper part of the board, unchanged during a gesture) and for hidden-card content, and with an e2e test that scrubbing shows the large card and that it never overlaps the scrubbed zone.

## 3. Strip

- [ ] 3.1 Add the board-level scrub coordinator: hand over between zones and rows, per-crossing haptic tick, selection painting across zones (D3, D4). Verify with an e2e test sliding from one zone into the next, wrapping to the next row and back, with an empty zone in between, and painting a selection across two zones.

## 4. Open and pinned zones

- [ ] 4.1 Add zone widening (width override in the row layout, neighbours shrink, layout locked for the gesture, exit margin) opened by a dwell during a drag, with the drop at the chosen slot and the zone closing after (D5). Verify with layout unit tests and an e2e test: drag over a narrow zone, hold, the zone widens, slide to a slot and release, the card lands in that slot; passing over without holding does not widen.
- [ ] 4.2 Add `pinnedZone`: a dwell while scrubbing or selecting pins a zone open; it closes on a tap on the felt, header, a control or a card elsewhere (the tap still acts), a sheet or drawer, clearing the selection or moving the cards, and not on scrolling (D6). Verify with unit tests for each rule and an e2e test: pin a narrow zone, select three cards, tap the felt (the zone closes, the selection stays), pin again, tap a header button (it opens and the zone closes).

## 5. Checks

- [ ] 5.1 Update `e2e/contrast.spec.ts` for the loupe and its details, and run lint, unit and e2e suites in full.

## Workflow follow-up

- Push to main to deploy, verify the live version, then archive the change.
