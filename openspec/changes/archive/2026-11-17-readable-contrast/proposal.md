# Proposal

## Why

Testing on real devices turned up unreadable text in two places. The table's green felt sets white text, and elements with their own light background inherited it, giving white text on a white or cream background. That hit the pop-up sheets (Draw, Deal and the others) and the counter's text box and Add button. Both were fixed on `main` (commits `265b263` and `ea4cbd4`), but no spec required readability and no test guarded it. A future styling change could bring the problem back unnoticed.

## What Changes

- Add a readability requirement: all text and controls stay legible against whatever they sit on (the felt, panels, sheets and drawers), in both light and dark color schemes.
- Record the rule behind the fixes: controls with their own background (text boxes, menus, buttons, sheets) use the panel's text color instead of inheriting it, and only controls designed for the felt use the felt's light text.
- Add an automated contrast check over the main screens (lobby, deck editor, table with sheets, drawer and counters open) at phone and desktop sizes, in light and dark mode, so the problem cannot return silently.
- No visible behavior changes beyond what is already on `main`.

## Capabilities

### New Capabilities
- `ui-readability`: The legibility of text, placeholders and controls across all screens and color schemes, including contrast thresholds and how contrast is verified.

### Modified Capabilities

None.

## Impact

- `client/src/styles.css`: already updated. This change only verifies that it meets the requirement.
- New end-to-end test `e2e/contrast.spec.ts`, plus a reusable contrast helper in `e2e/`.
- No server, protocol or data changes.
