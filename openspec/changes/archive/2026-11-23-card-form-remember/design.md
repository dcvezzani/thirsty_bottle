# Design

## Context

`CardForm` in `client/src/pages/DeckEditor.tsx` initialises its state from `card` (null when creating) and from the deck's `propertyTemplate`. Save calls `onSave`, which updates the draft and closes the sheet with `setEditing(null)`. The draft autosaves to the server, so anything placed in the deck content would sync and ship with the deck. The client already uses `localStorage` for small per-browser preferences (identities, chat card actions).

## Goals / Non-Goals

**Goals:**
- Fast creation of runs of similar cards on a phone, with the fewest taps.
- Pins are explicit and visible per field; nothing carries over silently.

**Non-Goals:**
- Auto-incrementing numbers or names (for example, rank 1, 2, 3).
- Pins while editing existing cards, and syncing pins across devices.
- Changes to Duplicate, bulk count editing, or the deck draft format.

## Decisions

**D1. Store pins in localStorage under a per-deck key.**
- Key: `vct.cardPins.<deckId>`.
- Value: `{ pinned: { name?, count?, description?, front?, back? : true }, props: { [key]: {type, value} }, abilities: Ability[], values: { name, count, description, front, back } }`.
- Reads and writes are wrapped in try/catch. If storage is unavailable, the form still works, and pins last only for the current sheet session in memory.
- Alternative considered: store pins in the deck draft. Rejected, because pins would autosave, appear in versions and exports, and be visible to anyone the deck is shared with.
- Alternative considered: session-only memory. Rejected, because a reload mid-run would lose the template.

**D2. Pin granularity.**
- Scalar fields each have a boolean pin.
- Property rows are pinned per row and identified by key. A pinned row restores its key, type and value. A pinned key that is also in the template takes the remembered value instead of blank.
- Ability rows are pinned per row and restored in order.
- Pins are recorded at save time from the values just saved ("follows the last save"). Toggling a pin on or off is itself remembered immediately, so it survives Cancel.

**D3. The pin control.**
- A small toggle button sits beside each field label or row, using a pin glyph, with `aria-pressed` and the label "Pin <field>". Pinned rows show the filled state.
- Hit area is 44px to match the touch-target rule. The default state uses the muted ink color and the pinned state uses the accent color, keeping the `ui-readability` contrast rules.
- Pins render only when `card === null`.

**D4. Save & add another.**
- `CardForm` gets an `onSaveAndNext` path. The parent saves the card, then remounts the form by bumping a `key` counter instead of closing it. The fresh mount reads the pins, which keeps state initialisation in one place.
- The parent passes the just-saved name to the new mount, so it can show the same-name hint, which is non-blocking.
- Name focus: with a pinned name, focus is set and the selection range goes to the end. Otherwise the field is focused empty.

**D5. Images.** A pinned front or back stores the image id only, so the next card reuses the already uploaded image. Image access rules are unaffected, because the image belongs to the same owner and deck.

## Risks / Trade-offs

- [A remembered property key no longer fits after the template changes] → Restore the row anyway. The user can remove it, and its pin is dropped with it.
- [Stale image id, for example an image removed or a deck cloned to a new id] → The key is per deck id, so a clone starts with no pins. If the image fails to load, the picker already shows its empty state.
- [More controls on a small screen] → The pin glyphs are compact and placed inline with existing labels and rows. No new rows are added.
- [Hint ignored, so duplicate names pile up] → This is acceptable by design. Names are not unique in decks.

## Migration Plan

Client-only, with no data migration. Rolling back removes the controls. Leftover localStorage keys are harmless.
