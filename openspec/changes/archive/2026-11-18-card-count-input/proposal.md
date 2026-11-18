# Proposal

## Why

Players can't choose an arbitrary number of cards. The Draw and Deal sheets clamp the count on every keystroke (`Math.max(1, Number(value))` in `client/src/table/Sheets.tsx`). Clearing the field to type a new number snaps it straight back to `1`, so on a phone you can't erase the `1` and type `12`. The Peek count turns an empty field into `0`, and Cut depth isn't bounded at all. None of these fields know how many cards are actually available.

## What Changes

- A shared **count control**: a slider plus a compact number field in a single row the size of today's input. You can type any value (the field may be empty while typing) or drag the slider; the value is clamped to the valid range when you finish.
- The valid range comes from the table state:
  - **Draw:** 1 to the pile size.
  - **Deal:** 1 to the cards per selected seat.
  - **Peek:** 1 to the pile size.
  - **Cut depth:** 1 to the pile size minus 1.
- Each action button shows the chosen count and is disabled while the field is empty.
- Used in the Draw, Deal, Peek and Cut controls. The deck editor's "Copies" and "Count for selected" fields are out of scope: they set definition counts, not a number of cards to act on.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `card-handling`: adds a requirement for choosing a number of cards (no existing requirement text changes).

## Impact

- New `client/src/components/CountField.tsx` and its styles in `client/src/styles.css`.
- `client/src/table/Sheets.tsx`: the Draw, Deal and Zone (Peek, Cut) sheets.
- New unit tests and e2e tests. No server or protocol changes; the server already caps requests at the available cards.
