# Tasks

## 1. Server

- [x] 1.1 Add migration 3 and the setups access check (D1, D2): `canView` with owner, builtin, public, link and table; non-owner read-only detail; edits stay owner-only; `applyToTable` and `clone` use `canView`. Verify with server tests: Sam can't see Alex's private setup (404); can view and clone it when public or with its link token; can view it after Alex applies it at Sam's table; can never edit it.
- [x] 1.2 Add visibility, share links, the gallery and search, cloning others' setups with labels and counts (D3, D5). Verify with server tests: visibility changes create a token; an archived link setup is unavailable; the gallery lists only active, public, unhidden, non-built-in setups, with name and owner prefix search and both sorts; a clone of Alex's setup by Sam is labelled "Cloned from Rummy by Alex" and the clone count rises.
- [x] 1.3 Add reports and the admin tool (D6). Verify with server tests: a report hides the setup from the gallery while the owner still lists it; a repeat report has no effect; a built-in can't be hidden; `admin.js reports`, `unhide <id>` and `hide <id>` work for setups and still for decks.
- [x] 1.4 Seed the built-in setups and add default-deck shareability and warnings (D4, D7). Verify with server tests: the three built-ins exist after start, appear in `builtIn`, and apply with their expected deals (Klondike 1..7 with the last face up; Crazy Eights 5 each for 3 players with 1 face-up discard; Hearts 18/17/17 for 3); a changed built-in content writes a new version on restart; applying another player's setup whose default deck is private asks for a deck; a fixed deal on an unviewable deck is refused with the owner message.

## 2. Client

- [ ] 2.1 Setups page Gallery tab and Built-in list, the read-only setup view with Clone and Report, visibility controls with share link and the default-deck warning, and the `/s/:token` page with Use at my table (D8). Verify with e2e tests: Alex publishes "Rummy" and sees the warning about a private default deck; Sam finds it in the gallery by "rum", opens it read-only, clones it ("Cloned from Rummy by Alex"); Sam opens a link setup at `/s/<token>`; after Sam reports it, it disappears from Sam's gallery search.
- [ ] 2.2 Apply setup sheet sections (Your setups, Built-in, Gallery) and the New table select's Built-in group. Verify with e2e tests: a solo host applies built-in Klondike (zones in order, P1..P7 with 1..7 cards, last face up); Sam applies Alex's public setup from the sheet's gallery search, choosing a deck where the default isn't available; Play again works for Sam on Alex's setup; contrast checks for the gallery, read-only view, share page and the sheet's new sections.

## 3. Verification

- [ ] 3.1 Run lint, all unit and server tests and the full e2e suite, push to `main`, and confirm the deploy.
