# Tasks

## 1. Project setup

- [ ] 1.1 Create the npm-workspaces monorepo (`shared/`, `server/`, `client/`) with TypeScript project references, ESLint, Prettier and Vitest. Verify that `npm install && npm run build && npm test` succeeds on the empty packages.
- [ ] 1.2 Add Playwright end-to-end scaffolding that launches the server and opens two browser contexts against it. Verify that a placeholder test passes.
- [ ] 1.3 Add a README covering setup, `npm run dev`, `npm start` and `DATA_DIR`. Verify that the documented commands run as written.

## 2. Shared protocol and table reducer

- [ ] 2.1 Define `CardDef`, `Deck`, `TableState`, `Zone`, `Seat`, `Action` and `Event` types with zod schemas in `shared/`. Verify with schema unit tests that accept valid samples and reject malformed ones.
- [ ] 2.2 Implement the pure table reducer for move, flip, flip-zone, reorder, pass, gather, counters and zone CRUD. Verify with unit tests covering each action, including face-state preservation and "flip during move".
- [ ] 2.3 Implement shuffle, cut (complete and split) and draw (top, bottom, random) with an injectable secure RNG. Verify with unit tests, including draw-more-than-available and a chi-square uniformity test of shuffle.
- [ ] 2.4 Implement deal (round-robin, start seat, face up or down). Verify that a 4×13 deal unit test empties the pile and gives each seat 13 cards in rotation order.
- [ ] 2.5 Implement show, peek and their automatic ending on move or gather. Verify with unit tests for show-to-one, show-to-all and show-ends-on-move.
- [ ] 2.6 Implement the `authorize` step: spectators read-only, the take-from-hand consent flow, the open-hands option, and the turn-based gate (own-hand reorder always allowed). Verify with unit tests for each turn-modes and table-play permission scenario.
- [ ] 2.7 Implement turn actions (setMode, endTurn, reverse, skip, setActive) and the next-seat calculation that skips empty or disconnected seats. Verify with unit tests for the turn-modes scenarios.
- [ ] 2.8 Implement log entries worded so they never reveal hidden identities, and single-step undo with the 10-second, no-intervening-action window. Verify with unit tests.

## 3. Server core and visibility

- [ ] 3.1 Set up the Fastify server, static client serving, the `ws` endpoint, zod message validation, the 64 KB limit and per-connection rate limiting. Verify with tests showing that malformed or oversized messages get error responses and the connection stays open.
- [ ] 3.2 Implement device-token identity (issue, store, resume), display name, color and duplicate-name suffixes. Verify with tests that reconnecting with the same token restores the identity.
- [ ] 3.3 Implement per-viewer projection with opaque handles that are regenerated on hidden moves and shuffles, plus the per-viewer handle map. Verify with tests showing that projected events for player B never contain player A's hand card definitions, and that a shuffled hidden card's handle never reappears.
- [ ] 3.4 Implement the table session: intent → authorize → reduce → version++ → project → broadcast, with acks and snapshot-on-gap. Verify with integration tests using two WebSocket clients for the simultaneous-last-card scenario.
- [ ] 3.5 Implement SQLite migrations, snapshot plus action-log persistence, and replay on startup. Verify with a test that restarts the server mid-game and checks identical zones, order and hands.
- [ ] 3.6 Implement presence, the 2-minute reconnect grace period, the disconnected-seat indicator after 5 seconds, host auto-transfer and turn auto-pass on grace expiry. Verify with integration tests using fake timers.

## 4. Deck library backend

- [ ] 4.1 Implement deck and card-def REST CRUD with ownership checks and count ≥ 1 validation. Verify with API tests, including rejecting a count of 0 and the delete-while-in-use behavior.
- [ ] 4.2 Implement image upload: type/size checks, `sharp` normalization to 750×1050 WebP plus a 250×350 thumbnail, content-addressed storage and access-controlled serving. Verify with tests for an off-ratio image and rejection of a 30 MB TIFF.
- [ ] 4.3 Implement JSON manifest and `.zip` import/export with per-card validation errors. Verify with a round-trip test and an invalid-count import test.
- [ ] 4.4 Seed the read-only standard 52-card deck (plus optional jokers) with `suit`/`rank` metadata and generated faces. Verify that loading it creates 52 face-down instances in one pile.
- [ ] 4.5 Document the deck manifest format in `docs/deck-format.md` with a sample manifest. Verify that the sample imports successfully in a test.

## 5. Lobby and chat backend

- [ ] 5.1 Implement the table lifecycle: create (seats, visibility, password hash, spectators, deck, layout), list, join/seat choice, spectate, leave (hand handling), invite links and closing after 30 minutes empty. Verify with integration tests for the lobby scenarios.
- [ ] 5.2 Implement host controls: settings, lock, move seat, kick, transfer host, load/unload deck, reset, close. Verify with integration tests including kick → returned to lobby.
- [ ] 5.3 Implement lobby and room chat channels with membership checks, 100-message history, retention, the 500-character limit, the 5-messages-per-5-seconds throttle, system messages, personal mute and host room mute. Verify with integration tests showing that room chat does not leak to the lobby and that a seated player can post to the lobby.

## 6. Client foundation

- [ ] 6.1 Build the app shell: routing (`/`, `/decks`, `/t/:id`), the WebSocket client with automatic reconnect and backoff, Zustand stores, version-gap detection and the snapshot request. Verify with unit tests of the connection store and a manual reconnect check (toggling offline in devtools).
- [ ] 6.2 Build the onboarding screen (name and color) and PWA manifest/service worker. Verify with an end-to-end test that the first visit and a reload keep the identity, and with a Lighthouse PWA installability check.

## 7. Lobby UI

- [ ] 7.1 Build the mobile lobby with tabs (Tables · Players · Chat): table list with status badges, presence list, create-table sheet, join/spectate/password flows and invite-link handling. Verify with Playwright at a 360×740 viewport, checking that there is no horizontal scroll and that touch targets are at least 44px.
- [ ] 7.2 Build the chat component (shared by lobby and room) with plain-text rendering, unread badges, system-message styling and mute. Verify with an end-to-end test that two players exchange lobby messages and that a `<script>` message stays inert.

## 8. Deck library UI

- [ ] 8.1 Build the deck list and editor: card grid, card form (name, description, count, front/back upload with a ratio preview), metadata editor with typed values and deck property templates, and the abilities editor. Verify with an end-to-end test that creates a deck with 2 cards, custom metadata and art.
- [ ] 8.2 Add import/export buttons and the generated text-only card face renderer. Verify with an end-to-end test that exports and re-imports a deck and checks that a text-only card renders its name.

## 9. Table UI

- [ ] 9.1 Build the board renderer: zones (pile/spread/free) with transform-positioned cards, pan and zoom, and seat markers with connection and active-turn indicators. Verify with component tests and a Playwright screenshot at 375px and 1280px.
- [ ] 9.2 Build the fanned hand: adaptive overlap, a raised selection, hover/press enlarge and drag-to-reorder. Verify with a Playwright test where 20 cards on 375px all stay tappable.
- [ ] 9.3 Add selection, drag-and-drop between zones, and the contextual action sheet (Flip, Move to…, Pass to…, Show to…, Peek, Shuffle, Cut, Draw top/bottom/random, Deal, Gather). Verify with end-to-end tests that two players pass and show cards and that each sees the correct faces.
- [ ] 9.4 Add optimistic prediction for deterministic actions, pending animations for random ones, rebase-and-animate on rejection, and interpolated live drag previews of other players. Verify with an end-to-end test of the rejected last-card drag animating back, plus a manual check for 60fps on a throttled-CPU profile.
- [ ] 9.5 Build the card info sheet (long-press or right-click) with full metadata and abilities for visible cards, the hidden-card view and the deck reference browser. Verify with end-to-end tests that a face-down card's info shows no identity.
- [ ] 9.6 Build the table drawer (Room · Lobby · Log · Info), the counters/notes panel, the mode toggle with turn controls, the "Your turn" notice with vibration, the undo button, and host management menus. Verify with end-to-end tests for switching modes mid-game and an out-of-turn action being refused.
- [ ] 9.7 Add action feedback: move, flip, shuffle and deal animations with actor labels in player colors. Verify by manually reviewing a recorded 4-player deal on a phone viewport.

## 10. Integration checks

- [ ] 10.1 Run a 4-player end-to-end game of Hearts (load the standard deck, shuffle, deal 13, pass 3 cards, play tricks to a shared spread, gather, score with counters) in turn-based mode, then switch to real-time mid-hand. Verify that the test passes with every client consistent at the end.
- [ ] 10.2 Run a network-level hidden-information audit: capture every WebSocket frame for one player across the Hearts test and assert that no other player's hidden card definitions appear. Verify that the test passes.
- [ ] 10.3 Run a performance check: a 12-seat, 500-card table with a scripted burst of actions, asserting that p95 server action-to-broadcast time is under 50 ms and client latency is under 300 ms on localhost. Verify that the benchmark meets the thresholds.
- [ ] 10.4 Run the restart-resilience check: kill and restart the server during the Hearts test and verify that all clients reconnect to identical state.

## Workflow follow-up

- Archive the change with `openspec archive virtual-card-table` after implementation is reviewed.
- Verify the archived specs appear under `openspec/specs/`.
