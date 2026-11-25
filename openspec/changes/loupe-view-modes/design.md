# Design

## Context

- **The loupe today** (`Loupe.tsx`, `loupe.ts`, `useUI.loupe`): a fixed box that never takes touches (`pointer-events: none`), showing `useUI.preview` large; `loupe.details` is set by a pause (`ZoneGesture` dwell) and cleared when the scrub moves on. `onScrubEnd` clears both `preview` and `loupe`.
- **Second fingers on the board:** `TwoFingerPan` (`pan.ts`, wired by `useBoardPan` on the board element) turns a second pointer on the board into a board pan and cancels card gestures. The loupe is rendered outside the board element, so a pointer that lands on the loupe is not seen by it.
- **Per-device preferences** are kept in `localStorage` with try/catch (`cardPins.ts`, the chat's card-action switch); nothing about them is sent to the server.
- **Selection:** `useUI.toggle/select/clear` own the yellow selection outline (`.selected`); a viewed card must not touch them.

## Goals / Non-Goals

**Goals:** a way to switch between the large card and details without lifting; a way to keep looking after lifting; both chosen per device.

**Non-Goals:** no server or protocol change; the header scrub (separate change) keeps working with whichever mode is chosen; no change to selection.

## Decisions

**D1. Preference store.**
- `lib/loupePrefs.ts`: `getLoupeMode()` returns the stored `'second-finger' | 'stay'` from `localStorage` key `vct.loupeMode`, or the default (`'second-finger'` when `navigator.maxTouchPoints >= 2`, else `'stay'`); `setLoupeMode()` stores it. Every access is in try/catch with an in-memory fallback.
- The table settings sheet gets an "On this device" group (shown to every player, not only the host) with a two-option radio, "Card loupe".

**D2. Two views, one choice.**
- `useUI.loupeFace: 'card' | 'details'` (session, not stored) is the chosen view; `loupe.peek` is the old transient pause state. The loupe shows details when `face === 'details' || peek`; moving on clears `peek` only.

**D3. Second-finger tap (mode "second-finger").**
- While a scrub is active the loupe takes touches (`pointer-events: auto` on the box, only then). A pointer that goes down on it and comes up within 250 ms and 10 px flips `loupeFace`; one that holds longer or moves does nothing. The scrubbing finger keeps its pointer capture, so the scrub carries on.
- Because the loupe is outside the board, a second finger on it does not start a board pan. A second finger anywhere else on the board is still a pan, as before.
- Release of the scrubbing finger clears the loupe as now.

**D4. Stay open (mode "stay").**
- On scrub end the row sets `useUI.viewed = { h, zone }` and leaves `preview` and `loupe` in place; the loupe adds a Card/Details toggle button and a close button, and takes touches on those controls only (the box itself stays `pointer-events: none`, the controls are `auto`).
- The viewed card gets `.viewed` (white dashed outline, a different shape and colour from `.selected`); viewing sets nothing in the selection.
- `viewed` ends (and the loupe closes) when: the close button or Escape; `onScrubStart` or `startDrag`; any selecting tap (`toggle`/`select` with a non-empty result) or a tap on the viewed card (handled in the row's tap before it toggles); a click on empty table (a capture-phase `click` on the board whose target is not inside a card, button, input, select or the loupe, so a scroll or pan, which produces no click, does not end it); a sheet or drawer opening (the same effect used for pinned zones).
- The side chosen at the press is kept, so the loupe does not jump when the finger lifts.

**D5. Interaction with pinned zones.** `viewed` and `openZone` are independent: a pause can still pin a zone open, and the viewed card stays viewed while it is open. Ending one does not end the other, except that closing a sheet or drawer closes both.

## Risks / Trade-offs

- **A second finger that lands on the loupe while the scrub is dwelling** could be mistaken for the dwell: they are separate pointers, and the dwell timer only watches the scrubbing finger.
- **Stay-open covers part of the board.** Its side was chosen not to cover the scrubbed zone; other zones under it are reached by dismissing or by scrolling the board.
- **Default detection:** `maxTouchPoints` is a hint; the setting corrects a wrong guess.
