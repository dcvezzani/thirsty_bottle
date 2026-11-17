# Design

## Context

This is a greenfield repository: it contains nothing except the OpenSpec scaffolding. See proposal.md for motivation and the specs for the required behavior. Constraints that shape the design:

- Mobile-first, touch-driven play in a browser, with no app store install. Desktop browsers must work too.
- Hidden information (hands, face-down cards, peeks) must be protected at the network level, not just in the UI (see `realtime-sync`).
- Play is rules-free, so the server is a generic state machine over cards and zones, not a game engine.
- The intended scale is small friend groups: tens of concurrent tables on one server, 1–12 seats per table.

## Goals / Non-Goals

**Goals:**
- One deployable Node.js process that serves the web app, the REST endpoints for decks and images, and the WebSocket endpoint.
- A shared, strongly typed protocol between client and server.
- A pure, unit-testable table reducer, `(state, action, actor) → (state', events)`, that holds all card logic.
- Smooth 60fps card interaction on mid-range phones.

**Non-Goals:**
- Horizontal scaling across multiple server instances (the design keeps that possible but does not build it).
- Game-specific rules, scripting, bots or automated execution of ability fields.
- Accounts, OAuth or cross-device identity sync. A device token is enough for v1.
- Native mobile builds. A PWA covers installability.

## Decisions

### D1. Stack: TypeScript monorepo, React + Vite client, Node server
- `shared/`: protocol types and zod schemas, and the table reducer (so the client can run it for optimistic prediction).
- `server/`: Node 22, Fastify (HTTP, static files, uploads), `ws` for WebSockets, `better-sqlite3`, and `sharp` for images.
- `client/`: React 18 + Vite, Zustand for state, Framer Motion / CSS transforms for card animation, and `vite-plugin-pwa`.
- npm workspaces. Vitest for unit tests, Playwright for end-to-end tests (multiple browser contexts simulate multiple players).

**Alternatives considered:** Unity, Godot and Phaser. A game engine adds a heavy WebGL bundle and weak native text and UI handling (chat, forms, deck editor). Its strengths, physics and 3D, are not needed for a card table. DOM/CSS transforms handle tens of animated cards easily and give accessibility and text rendering for free. Phaser stays an option later for a canvas-rendered board if performance demands it. Socket.IO was rejected in favor of plain `ws` plus our own small reconnection layer, because the protocol needs explicit versioning anyway.

### D2. The server owns the table state, and each viewer receives a filtered projection
The canonical `TableState` holds zones, ordered lists of instance IDs, each instance's `{defId, tableDeckId, copyNo, copyOf, faceUp, shownTo[], peekedBy[]}` (`copyNo`/`copyOf` are assigned in deck order when the deck snapshot is loaded, and are fixed until a reload), seats, mode, turn, counters and the log. After each accepted action, the server builds a **projection per recipient**:
- A card the viewer may see → `{handle, defId, copyNo, copyOf, faceUp, …}`.
- A card the viewer may not see → `{handle, back: backImageId}`. It never includes `copyNo`, because a visible per-copy number on hidden cards would act like a marked card.

**Handles** are opaque per-viewer IDs. A hidden card's handle is regenerated whenever the card moves into or within a hidden position (shuffle, move into a pile, pass between hands), which satisfies the "cannot track shuffled card" scenario. The server keeps a per-viewer `handle → instanceId` map to resolve incoming intents.

**Alternatives considered:** client-side encryption or mental-poker protocols. They are overkill, because the server is trusted by design.

### D3. Protocol: intents in, versioned events/patches out
- Client → server: `{type:"intent", seq, tableId, action}`, where `action` is a discriminated union (`move`, `flip`, `shuffle`, `cut`, `draw`, `deal`, `show`, `peek`, `gather`, `counter`, `endTurn`, `setMode`, …).
- Server → client: `{type:"ack", seq, ok, error?}` plus `{type:"events", version, events[]}`, where events are already projected for that viewer. A `snapshot` message is sent on join, reconnect or a detected gap.
- Lobby and chat use the same socket with channel-scoped messages (`lobby.*`, `chat.*`, `table.*`).
- Every inbound message is validated with zod, and messages over 64 KB are dropped.

### D4. Optimistic prediction using the shared reducer
The client applies its own intent locally through the same reducer, but only for operations whose outcome it can predict: moves of visible cards, flips of cards it owns, and its own hand reordering. Random or hidden outcomes (shuffle, draw, deal) show an immediate "pending" animation and wait for the server's events. On a negative `ack` or a version mismatch, the client rebases: it discards its pending local ops, applies the authoritative state, and animates any differences. Drag previews are sent as unacknowledged `table.drag` messages throttled to 15Hz, which other clients interpolate.

### D5. Turn-mode gate inside the reducer
The reducer has an `authorize(state, actor, action)` step. In turn-based mode it rejects actions that touch shared zones or other players' zones unless the actor is the active player. Own-hand reordering, card info, chat and consent responses are always allowed. Switching mode is just another action, so it is ordered, logged and undoable like any other.

### D6. Persistence: SQLite with snapshot plus append log
- Tables: `players`, `decks`, `deck_versions`, `deck_drafts`, `card_defs` (metadata as a JSON column, keyed to a deck version), `images`, `tables`, `table_decks`, `table_snapshots`, `table_actions`, `chat_messages`.
- Each table persists a full snapshot every 50 actions and on idle, plus an append-only action log in between. On restart, the server loads the latest snapshot and replays the actions after it. This also powers undo: the server keeps the inverse of the last action.
- Images live on disk under `data/images/<sha256>.<webp>` (content-addressed, deduplicated). They are normalized by `sharp` to 750×1050 WebP with a 250×350 thumbnail.

### D7. Card metadata model
`CardDef = {id, name, description?, frontImageId?, backImageId?, count, metadata: Record<string, string|number|boolean|string[]>, abilities?: {trigger, effect, value?, target}[]}`. Decks carry `propertyTemplate: {key, type}[]` to drive the editor. The JSON manifest format matches this shape. A `.zip` export bundles `deck.json` and `images/`. CSV import is out of scope, because spreadsheet tools can export JSON through templates.

### D7a. Deck lifecycle, versions, cloning and gallery
- `decks` = `{id, owner_id, name, description, status: active|archived, archived_at?, visibility: private|link|public, share_token?, cloned_from_deck_id?, cloned_from_label?, current_version_id, clone_count}`.
- **Versions:** each Save writes an immutable `deck_versions` row holding the full card list. `deck_drafts` holds one working copy per deck, written as the owner edits (debounced), and is cleared on save or discard. Readers other than the owner always resolve `current_version_id`.
- **Table snapshots:** loading a deck copies the version's card definitions into `table_decks` (JSON). Table play never reads `decks` again, which makes edit, archive and delete safe while a game is running. The host gets a "newer version available" flag by comparing version IDs.
- **Cloning:** a server-side copy of the current version into a new deck owned by the cloner. Because images are content-addressed (D6), they are shared without being copied. The source's `clone_count` goes up, and the source name and owner are stored as a frozen label so the attribution survives the source's deletion.
- **Deletion:** allowed only when `status = archived`. This removes the deck, its versions and its draft. A periodic garbage collector removes image files that no longer have any reference from `deck_versions`, `deck_drafts` or `table_decks`.
- **Access check:** one `canView(player, deck)` function governs viewing. It allows the owner; built-in decks; `link` decks with a valid share token; `public` decks; and any deck loaded on a table the player is currently at (served from the table snapshot). In every case except the owner, the deck must also be active. A private deck refuses with "not found", so its existence isn't revealed.
- **Gallery:** a paged query over decks that are public and active, with a name/owner search (SQLite FTS5) and sorting by newest or most cloned.
- **Routes:** `/decks` (tabs: My decks · Archived · Gallery), `/decks/:id` editor or preview, and `/d/:shareToken` link view.

### D8. Identity
On first visit the server issues a random 256-bit device token, which the client stores in `localStorage`. It is sent on WebSocket connect and as a bearer token for REST calls. The display name and color are stored per player. There are no passwords. A table password is checked server-side against an Argon2 hash.

### D9. Mobile UI architecture
- Routes: `/` lobby (tabs: Tables · Players · Chat), `/decks` library, gallery and editor (see D7a), `/t/:tableId` table.
- Table screen: a zoomable/pannable board (shared zones) in the upper area, your fanned hand along the bottom edge, and a slide-up drawer with tabs **Room · Lobby · Log · Info**. Lobby chat is reachable from that drawer, which satisfies the chat spec.
- Interaction (see D11): tap toggles selection, a sideways slide scrubs (preview, or paint-select once something is selected), a stationary hold opens card info, pulling out drags the card or selection, and a contextual action sheet lists every action for the selection (Flip, Show to…, Pass to…, Move to…, Peek). Every gesture has a non-gesture fallback.
- Cards render as absolutely positioned elements moved with `transform` (GPU compositing), and images load from thumbnails first.

### D10. Randomness
Shuffles use Fisher–Yates driven by `crypto.randomInt`. Random draws and random cut depths use the same source. Nothing random happens on the client.

### D11. Gesture recognition and scrubbing
- One Pointer Events state machine per zone (hand, spread, fanned-out pile), not listeners on each card. States: `idle → pressed → {scrub | drag | longPress | tap}`. After about 8px of movement it locks to an axis: sideways means scrub; up or out of the zone means drag. A still hold of 450 ms (movement under 8px) opens card info. Release under 250 ms with no movement is a tap. Uses `touch-action: none` on zones and pointer capture.
- Hit-testing is computed from the fan layout's math (card index from the pointer's x position, accounting for arc rotation and overlap), so it stays O(1) per pointer event and is unaffected by DOM overlap.
- Magnification: the hovered card is translated up and scaled about 1.6×, and its neighbors are pushed apart with a falloff. Everything is done with `transform` in a single `requestAnimationFrame` write. The enlarged preview floats above the finger so the finger doesn't cover it.
- Paint mode is decided at scrub start (if any cards in the zone are selected: select when the scrub starts on an unselected card, deselect when it starts on a selected one; if none are selected: preview only). Selection is client-local state until an action is sent.
- Haptics: `navigator.vibrate(5)` on each card change, where supported.
- Group drag sends a single `move` intent carrying an ordered `handles[]` plus a target zone and index, so the reducer, log and undo treat it as one action. While dragging, the client computes the insertion index and animates the gap locally.
- Desktop: hover gives the preview, click toggles selection, Shift+click selects a range, and drag works the same way.
- Recent destinations (the last 3) are kept per player in client storage.

**Alternatives considered:** a gesture library such as Hammer.js or use-gesture. It is unnecessary for this narrow set of gestures and adds coupling to how it handles axis locking. Per-card DOM hit-testing breaks down with heavily overlapped fans.

## Risks / Trade-offs

- [Per-viewer projection costs CPU on large tables] → Tables have at most 12 seats and a few hundred cards. Projections are computed incrementally (per event, not by diffing the full state). Measure with a 12-seat, 500-card benchmark test.
- [Handle remapping complicates the client's animation continuity] → The server sends `{fromHandle, toHandle}` pairs in move events, so the client can animate a hidden card that is renamed in flight.
- [A device-token identity is lost if browser storage is cleared] → Accepted for v1. Offer a "copy recovery code" in settings that is the token itself.
- [Optimistic prediction diverges in real-time contention] → Prediction is limited to deterministic operations, and the rebase-and-animate approach keeps divergence brief and visible rather than silent.
- [Uploaded images could be abusive or very large] → There is a size limit, decoding happens in `sharp` (which rejects malformed files), images are only served to users who can access the deck or table, and there is no public gallery.
- [Gesture conflicts with browser scroll or zoom on mobile] → Use `touch-action: none` only on card zones, and pan the board with two fingers or on empty board space. Tune thresholds in an on-device test pass.
- [The public gallery may receive unwanted or infringing artwork] → Decks are opt-in public. Add a "report deck" action that hides a deck pending review by a server admin (a CLI command in v1).
- [Deck versions accumulate storage] → Versions are small JSON rows and images are deduplicated. Prune versions that are neither current nor referenced by `table_decks` once they are older than 30 days.
- [Single-process design limits scale] → Acceptable for friend groups. Table state is isolated per table, so sharding by table ID later would be straightforward.

## Migration Plan

This is a greenfield deployment, so no migration is needed. Running `npm run build && npm start` serves everything on one port, with `DATA_DIR` holding SQLite and images. Rolling back means stopping the process. The data directory is forward-compatible through numbered SQL migrations run at startup.

## Open Questions

- Should hosts be able to save a table's zone layout as a reusable "table template" separate from decks? The data model supports it, and it can be added after v1 without changing these specs.
- Whether to offer optional sound effects for shuffles, deals and turn notices (a cosmetic setting).
