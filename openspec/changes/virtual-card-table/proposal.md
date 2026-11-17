# Proposal

## Why

We want to play any card game with friends over the network: classics like hearts and spades, or games we make up, with our own artwork. Digital card games usually hardcode each game's rules. This project instead builds a **rules-free virtual card table** that works like a physical one. The server handles the parts that have to be trustworthy (shuffling, hidden information, turn order when wanted), and players decide everything else themselves.

## What Changes

- New mobile-first web app (it also works on desktop browsers) backed by an authoritative game server reached over WebSockets.
- **Deck library**: create and edit decks. Each deck has front and back artwork per card, an instance count per card, a free-form description, and flexible metadata (any key/value properties, including optional structured "ability" fields such as trigger, effect type, effect value and targeting). Decks can be imported and exported as JSON so they can be bulk-authored in spreadsheets or editors.
- **Card handling**: tedium-free touch interaction. Scrub through fanned hands and spreads to preview cards, paint-select groups in one stroke, and drag a whole selection anywhere (including onto a player to pass it), with quick repeat destinations.
- **Card info**: any player can open a card they are allowed to see and view its name, description, artwork and all of its metadata.
- **Virtual table**: free-form zones (draw piles, discard piles, hands, face-up and face-down spreads, per-player areas). Common physical actions work in any game: shuffle, cut, deal, draw from the top, bottom or at random, flip, move or pass cards between players, show a card to one player or to everyone, peek, and recall cards to a deck. **No game rules are enforced.**
- **Turn modes**: each table can switch between *real-time* (anyone acts any time) and *turn-based* (only the active player acts, and the turn passes in seat order) at any moment.
- **Lobby & table management**: see open tables, then create, join, spectate or leave them. Hosts can configure, lock, kick players and reset a table. The lobby shows who is online.
- **Chat**: a global lobby chat, plus a per-table room chat. Lobby chat stays available while seated at a table.
- **Real-time sync**: every state change goes through the server. Clients show optimistic local feedback and reconcile with the server, and reconnect without losing their seat or hand.

## Capabilities

### New Capabilities
- `deck-library`: Managing decks and card definitions: artwork (front/back), instance counts, descriptions, flexible metadata and ability fields, and JSON import/export.
- `card-handling`: How players view, select and move cards on touch and pointer devices: hand/board layout, scrub-to-preview through fans and spreads, paint selection, group drag with insertion gaps, quick destinations, and atomic group actions.
- `card-info`: Viewing a card's details (artwork, name, description, metadata) under the table's visibility rules.
- `table-play`: The rules-free shared table: zones, card instances, visibility (face-up, face-down, private, shown), and the physical card actions (shuffle, cut, draw, deal, flip, move, pass, show, peek).
- `turn-modes`: Per-table switching between real-time and turn-based play, active-player tracking and passing the turn.
- `lobby`: Player identity and presence, plus the table lifecycle (create, list, join, spectate, leave) and host management controls.
- `chat`: Lobby-wide chat and per-table room chat, including access to lobby chat from inside a table.
- `realtime-sync`: The authoritative server state model, the action/event protocol, per-viewer hidden-information filtering, optimistic client feedback, and reconnection.

### Modified Capabilities

None. This is a greenfield project.

## Impact

- New codebase: a TypeScript monorepo with `server/` (Node.js, WebSockets, persistence, image storage), `client/` (mobile-first web app, installable as a PWA) and `shared/` (protocol and data types).
- New dependencies: a WebSocket library, an embedded database (SQLite) and an image processing library for normalizing artwork to the 2.5:3.5 card ratio.
- Hosting: one server process serves both the app and the WebSocket endpoint. Uploaded artwork is stored on local disk.
- Out of scope for this change: user accounts with passwords, matchmaking/ranking, scripted rule engines and automated ability execution (ability fields are descriptive only), native app store builds, and voice/video.
