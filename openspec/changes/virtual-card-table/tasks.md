# Tasks

## 1. Project setup

- [x] 1.1 Create the npm-workspaces monorepo (`shared/`, `server/`, `client/`) with TypeScript project references, ESLint, Prettier and Vitest. Verify that `npm install && npm run build && npm test` succeeds on the empty packages.
- [x] 1.2 Add Playwright end-to-end scaffolding that launches the server and opens two browser contexts against it. Verify that a placeholder test passes.
- [x] 1.3 Add a README covering setup, `npm run dev`, `npm start` and `DATA_DIR`. Verify that the documented commands run as written.

## 2. Shared protocol and table reducer

- [x] 2.1 Define `CardDef`, `Deck`, `TableState`, `Zone`, `Seat`, `Action` and `Event` types with zod schemas in `shared/`. Verify with schema unit tests that accept valid samples and reject malformed ones.
- [x] 2.2 Implement the pure table reducer for move, flip, flip-zone, reorder, pass, gather, counters and zone CRUD. Verify with unit tests covering each action, including face-state preservation and "flip during move".
- [x] 2.3 Assign `copyNo`/`copyOf` per definition in deck order when a deck snapshot is loaded (renumbered on reload, scoped per loaded deck). Verify with unit tests that a count-3 definition yields #1–#3 and that numbers are unchanged after shuffle, move, gather and reset.
- [x] 2.4 Implement shuffle, cut (complete and split) and draw (top, bottom, random) with an injectable secure RNG. Verify with unit tests, including draw-more-than-available and a chi-square uniformity test of shuffle.
- [x] 2.5 Implement deal (round-robin, start seat, face up or down). Verify that a 4×13 deal unit test empties the pile and gives each seat 13 cards in rotation order.
- [x] 2.6 Implement show, peek and their automatic ending on move or gather. Verify with unit tests for show-to-one, show-to-all and show-ends-on-move.
- [x] 2.7 Implement the `authorize` step: spectators read-only, the take-from-hand consent flow, the open-hands option, and the turn-based gate (own-hand reorder always allowed). Verify with unit tests for each turn-modes and table-play permission scenario.
- [x] 2.8 Implement turn actions (setMode, endTurn, reverse, skip, setActive) and the next-seat calculation that skips empty or disconnected seats. Verify with unit tests for the turn-modes scenarios.
- [x] 2.9 Implement log entries worded so they never reveal hidden identities, and single-step undo with the 10-second, no-intervening-action window. Verify with unit tests.

## 3. Server core and visibility

- [x] 3.1 Set up the Fastify server, static client serving, the `ws` endpoint, zod message validation, the 64 KB limit and per-connection rate limiting. Verify with tests showing that malformed or oversized messages get error responses and the connection stays open.
- [x] 3.2 Implement player-token identity (issue, resume), display name, color, duplicate-name suffixes, and one active socket per token (the newer connection wins and the older one receives `session.replaced`). Verify with tests that reconnecting with the same token restores the identity and that a second socket replaces the first.
- [x] 3.3 Implement per-viewer projection with opaque handles that are regenerated on hidden moves and shuffles, plus the per-viewer handle map. Verify with tests showing that projected events for player B never contain player A's hand card definitions, that a shuffled hidden card's handle never reappears, and that no hidden card's projection includes `copyNo`.
- [x] 3.4 Implement the table session: intent → authorize → reduce → version++ → project → broadcast, with acks and snapshot-on-gap. Verify with integration tests using two WebSocket clients for the simultaneous-last-card scenario.
- [x] 3.5 Implement SQLite migrations, snapshot plus action-log persistence, and replay on startup. Verify with a test that restarts the server mid-game and checks identical zones, order and hands.
- [x] 3.6 Implement presence, the 2-minute reconnect grace period, the disconnected-seat indicator after 5 seconds, host auto-transfer and turn auto-pass on grace expiry. Verify with integration tests using fake timers.

## 4. Deck library backend

- [x] 4.1 Implement deck and card-def REST CRUD with ownership checks and count ≥ 1 validation, card duplicate/reorder/bulk-count, and copying cards from any viewable deck. Verify with API tests, including rejecting a count of 0 and copying cards from a public deck.
- [x] 4.2 Implement drafts and versioned save/discard (immutable `deck_versions`, one draft per deck). Verify with API tests showing that non-owners see only the saved version and that a draft survives a reload.
- [x] 4.3 Implement the archive/restore lifecycle and archived-only permanent delete with confirmation, plus image garbage collection. Verify with API tests: deleting an active deck is refused, restore keeps the version and visibility, and a clone survives deletion of its source.
- [x] 4.4 Implement visibility (private/link/public), share tokens and the `canView` access check (owner, built-in, link, public, loaded on my table; active only; private refuses as not found). Verify with API tests for each access path and for an archived deck's link being refused.
- [x] 4.5 Implement cloning (copy the current version, private and owned by the cloner, frozen "Cloned from" label, shared images, clone_count). Verify with API tests: a clone is independent of later source edits and deletion, and an archived source can't be cloned by others.
- [x] 4.6 Implement table deck snapshots (`table_decks`) on load, the "newer version available" flag and reload. Verify with an integration test that editing and then deleting the source deck leaves table play and card info intact.
- [x] 4.7 Implement the public gallery query (active and public only, FTS search, newest/most-cloned sort, paging) and the report-deck hide. Verify with API tests showing that archiving withdraws a deck from the gallery.
- [x] 4.8 Implement image upload: type/size checks, `sharp` normalization to 750×1050 WebP plus a 250×350 thumbnail, content-addressed storage and access-controlled serving. Verify with tests for an off-ratio image and rejection of a 30 MB TIFF.
- [x] 4.9 Implement JSON manifest and `.zip` import/export (export any viewable deck; import creates a new private deck owned by the importer) with per-card validation errors. Verify with a round-trip test and an invalid-count import test.
- [x] 4.10 Seed the read-only standard 52-card deck (plus optional jokers) with `suit`/`rank` metadata and generated faces. Verify that loading it creates 52 face-down instances in one pile.
- [x] 4.11 Document the deck manifest format and deck lifecycle (save, archive, delete, visibility, clone) in `docs/deck-format.md` with a sample manifest. Verify that the sample imports successfully in a test.

## 5. Lobby and chat backend

- [ ] 5.1 Implement the table lifecycle: create (optional seat count or open seating, visibility, optional password hash, spectators, deck, layout), mid-game join (empty hand, appended to seat and turn order, blocked when locked or at 12), list, join/seat choice, spectate, leave (hand handling), invite links and closing after 30 minutes empty. Verify with integration tests for the lobby scenarios, including a minimal name-only table, joining an open table mid-game, and the 12-seat cap.
- [ ] 5.2 Implement host controls: settings (including setting or removing the password and seat count), lock, move seat, kick, designate host (always allowed for the current host, regardless of mode or turn), load/unload deck, reset, close. Verify with integration tests, including kick → returned to lobby and host handover during another player's turn.
- [ ] 5.3 Implement lobby and room chat channels with membership checks, 100-message history, retention, the 500-character limit, the 5-messages-per-5-seconds throttle, system messages, personal mute and host room mute. Verify with integration tests showing that room chat does not leak to the lobby and that a seated player can post to the lobby.

## 6. Client foundation

- [ ] 6.1 Build the app shell: routing (`/`, `/decks`, `/t/:id`), the WebSocket client with automatic reconnect and backoff, Zustand stores, version-gap detection and the snapshot request. Verify with unit tests of the connection store and a manual reconnect check (toggling offline in devtools).
- [ ] 6.2 Build the onboarding screen (name and color), per-tab identity (`sessionStorage` token, `localStorage` identity list, "continue as…" picker, `BroadcastChannel` duplicate-tab detection, "open in another window" notice, `?newPlayer`), and PWA manifest/service worker. Verify with end-to-end tests: two tabs in one browser context play as different players at one table; a reload keeps each tab's identity; and both tabs reconnect to their own seats after the network is toggled offline and back. Also verify with a Lighthouse PWA installability check.

## 7. Lobby UI

- [ ] 7.1 Build the mobile lobby with tabs (Tables · Players · Chat): table list with status badges, presence list, create-table sheet (only the name required; seat count and password optional), "open seating" display, join/spectate/password flows and invite-link handling. Verify with Playwright at a 360×740 viewport, checking that there is no horizontal scroll and that touch targets are at least 44px.
- [ ] 7.2 Build the chat component (shared by lobby and room) with plain-text rendering, unread badges, system-message styling and mute. Verify with an end-to-end test that two players exchange lobby messages and that a `<script>` message stays inert.

## 8. Deck library UI

- [ ] 8.1 Build the library screen with tabs (My decks · Archived · Gallery): archive/restore, delete-with-confirm on archived decks only, a visibility picker with a copyable share link, gallery search and preview, Clone buttons, and the `/d/:token` link view. Verify with an end-to-end test where player B finds player A's public deck in the gallery, clones it and edits the clone, and A's deck is unchanged.
- [ ] 8.2 Build the deck editor with draft/save/discard (resume-draft prompt and an unsaved indicator) and card management (add, duplicate, reorder, multi-select bulk count, copy cards from another deck). Verify with an end-to-end test that unsaved edits survive a reload and that discard restores the saved version.
- [ ] 8.3 Build the card form (name, description, count, front/back upload with a ratio preview), metadata editor with typed values and deck property templates, and the abilities editor. Verify with an end-to-end test that creates a deck with 2 cards, custom metadata and art.
- [ ] 8.4 Add import/export buttons and the generated text-only card face renderer. Verify with an end-to-end test that exports and re-imports a deck and checks that a text-only card renders its name.

## 9. Table UI

- [ ] 9.1 Build the board renderer: zones (pile/spread/free) with transform-positioned cards, pan and zoom, seat markers with connection and active-turn indicators, and copy-number badges on visible faces of duplicated definitions (none for single copies or hidden cards). Verify with component tests and a Playwright screenshot at 375px and 1280px.
- [ ] 9.2 Build the fanned hand: adaptive overlap, a raised selection, hover enlarge on desktop and drag-to-reorder. Verify with a Playwright test where 20 cards on 375px all stay tappable.
- [ ] 9.3 Implement the zone gesture recognizer (axis lock, scrub, drag, 450 ms still-hold, tap) with layout-math hit-testing. Verify with unit tests feeding simulated pointer sequences for each gesture and the scrub-then-pull-out transition.
- [ ] 9.4 Add scrub-to-preview with magnification and haptic ticks for hands, spreads and fanned-out piles (backs only for hidden cards). Verify with a Playwright touch-emulation test that the preview shows each card in turn and that releasing changes nothing.
- [ ] 9.5 Add paint selection (select or deselect mode decided at scrub start, preview-only with no selection), the selection count, Select all/Clear, Shift+click range select on desktop, and auto-clear after a move. Verify with an end-to-end test that tap plus scrub selects 5 cards, and that scrubbing from a selected card deselects.
- [ ] 9.6 Add group drag (ordered stack with a count badge, drop-zone highlights, insertion gap, drop-on-seat passes), sent as a single multi-handle move intent. Verify with an end-to-end test that 5 cards are passed in one drag, the log shows one entry, and one undo restores all 5.
- [ ] 9.7 Add the contextual action sheet (Flip, Move to…, Pass to…, Show to…, Peek, Shuffle, Cut, Draw top/bottom/random, Deal, Gather, Fan out) with the 3 recent destinations first and "Send again". Verify with end-to-end tests that two players pass and show cards with correct faces, and that "Send again" repeats the last destination.
- [ ] 9.8 Add optimistic prediction for deterministic actions, pending animations for random ones, rebase-and-animate on rejection, and interpolated live drag previews of other players. Verify with an end-to-end test of the rejected last-card drag animating back, plus a manual check for 60fps scrub and drag of a 30-card hand on a throttled-CPU profile.
- [ ] 9.9 Build the card info sheet (still-hold or right-click) with full metadata and abilities for visible cards, the hidden-card view, and the deck reference browser with "Clone to my library". It shows "Copy n of N" and the source deck name when the name is ambiguous. Verify with end-to-end tests that a face-down card's info shows no identity or copy number, and that two face-up copies of the same card show different copy numbers in card info and in the log.
- [ ] 9.10 Build the table drawer (Room · Lobby · Log · Info), the counters/notes panel, the mode toggle with turn controls, the "Your turn" notice with vibration, the undo button, and host management menus. Verify with end-to-end tests for switching modes mid-game and an out-of-turn action being refused.
- [ ] 9.11 Add action feedback: move, flip, shuffle and deal animations with actor labels in player colors. Verify by manually reviewing a recorded 4-player deal on a phone viewport.

## 10. Integration checks

- [ ] 10.1 Run a 4-player end-to-end game of Hearts (load the standard deck, shuffle, deal 13, pass 3 cards, play tricks to a shared spread, gather, score with counters) in turn-based mode, then switch to real-time mid-hand. Verify that the test passes with every client consistent at the end.
- [ ] 10.2 Run a network-level hidden-information audit: capture every WebSocket frame for one player across the Hearts test and assert that no other player's hidden card definitions appear. Verify that the test passes.
- [ ] 10.3 Run a performance check: a 12-seat, 500-card table with a scripted burst of actions, asserting that p95 server action-to-broadcast time is under 50 ms and client latency is under 300 ms on localhost. Verify that the benchmark meets the thresholds.
- [ ] 10.4 Run the restart-resilience check: kill and restart the server during the Hearts test and verify that all clients reconnect to identical state.

## Workflow follow-up

- Archive the change with `openspec archive virtual-card-table` after implementation is reviewed.
- Verify the archived specs appear under `openspec/specs/`.
