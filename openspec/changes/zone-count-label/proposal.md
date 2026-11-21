# Proposal

## Why

Every zone's label shows its card count ("P5 · 5"), but the whole label is cut off with an ellipsis when the zone is narrow. A fit-width pile named "Standard 52" holding 27 cards shows only "Standard...", so the count disappears; piles still have their card badge, but any column with a longer name, such as "Tableau 3", loses its count entirely. The count is the part players need at a glance.

## What Changes

- **The count is always shown in full.** When a label doesn't fit, the zone name is shortened with an ellipsis and the count stays visible.
- **Everywhere a zone label appears:** fit, half and full zones, and the slim bars of empty zones.
- **Unchanged:** the pile's card badge, arrange-mode tiles (which show names only), and the label's tap and long-press behavior.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `table-play`: a new requirement, "Zone card count", says every shared zone's label shows its card count, which stays fully visible however narrow the zone, with the name shortened instead.

## Impact

- **Client:** the zone label in `client/src/table/Zones.tsx` splits into a name part that can shorten and a count part that never shrinks, with matching CSS in `client/src/styles.css`.
- **No server, protocol or data changes.**
- **Tests:** an e2e check on a 375-pixel phone with a long-named pile and a row of seven columns, plus the existing contrast check.
