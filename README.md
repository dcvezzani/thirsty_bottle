# Card Table

A rules-free virtual card table for playing any card game with friends over the network: classic games or ones you invent, with your own artwork. The server shuffles, deals and keeps hidden cards hidden. Everything else is up to the players, just like at a real table.

Mobile-first web app (installable as a PWA) + a single Node.js server.

## What you can do

- **Lobby**: see who's online and which tables are open; create a table with just a name (seat count, password, deck and visibility are optional); join, watch, or open a private table by invite link. Lobby chat works from anywhere, including inside a game.
- **Table**: piles, spreads and free areas; private hands. Shuffle, cut, deal, draw from the top/bottom/at random, flip, move, pass, show cards to one player or everyone, peek, gather, reset. Counters and shared notes for scores. No game rules are enforced.
- **Handling cards**: slide your finger along a hand or spread to preview cards (scrubbing). Tap a card, then scrub to paint-select more. Pull a selection up to drag the whole stack anywhere, including onto a player to pass it. Hold still on a card for its details. "Send again" repeats your last destination. Desktop: hover, click, Shift+click, right-click.
- **Turn modes**: switch any time between real-time and turn-based (only the active player changes shared zones).
- **Decks**: build decks with front/back artwork (normalized to 2.5:3.5), copy counts, free-form metadata and descriptive abilities. Save/draft, archive, delete (archived only), share by link or publish to the gallery, clone anyone's deck, import/export (.zip / .json; see [docs/deck-format.md](docs/deck-format.md)). Two built-in standard decks.
- **Fair play**: the server shuffles with a secure RNG and never sends a client the identity of a card it can't see (other hands, face-down cards, copy numbers). Seats and hands survive network drops (2-minute grace) and server restarts.

## Requirements

- Node.js 22+ (see `.nvmrc`; with nvm or fnm run `nvm use`)
- npm 10+

## Setup

```bash
npm install
npm run build
```

## Run

```bash
npm start
```

Serves the app, REST API and WebSocket endpoint on one port (default `3000`): open http://localhost:3000.

| Variable   | Default  | Meaning                                                        |
| ---------- | -------- | -------------------------------------------------------------- |
| `PORT`     | `3000`   | HTTP/WebSocket port                                            |
| `DATA_DIR` | `./data` | Where the SQLite database (`cardtable.db`) and uploaded images live |

Back up `DATA_DIR` to keep decks, tables and chat history.

## Play over your network

`npm start` prints a `Network:` address (for example `http://192.168.1.23:3000/`). Friends on the same Wi-Fi open that address, and you may need to allow incoming connections on the port in your firewall. For friends elsewhere, use a tunnel such as `cloudflared tunnel --url http://localhost:3000`, `ngrok http 3000` or `tailscale funnel 3000`. These also give you `https://`, which browsers require for installing the app and for the copy buttons.

**Windows + WSL2:** WSL2 runs behind its own virtual network, so other devices can't reach it by default. On Windows 11, enable mirrored networking: add the following to `%UserProfile%\.wslconfig`

```ini
[wsl2]
networkingMode=mirrored
```

then run `wsl --shutdown` and reopen your terminal. Also allow the port through Windows Defender Firewall (in an admin PowerShell: `New-NetFirewallRule -DisplayName "Card Table" -Direction Inbound -Protocol TCP -LocalPort 3000,5173 -Action Allow`). Use your Windows machine's Wi-Fi IP address (`ipconfig`). The address WSL prints is internal unless mirrored mode is on. On Windows 10, forward the port instead: `netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=<WSL IP from "hostname -I">`.

## Develop

```bash
npm run dev
```

Runs the server with auto-restart on port 3000 and the Vite dev server (with hot reload) on port 5173. Open http://localhost:5173 (other devices can use the `Network:` address Vite prints). API and WebSocket calls are proxied to the server. For actually playing with friends, prefer `npm run build && npm start`: it's one port and much faster to load.

Tip: every browser tab can be a different player. Open several tabs, or add `?newPlayer` to a URL to create another player, to test multiplayer by yourself.

## Test

```bash
npm test          # unit + integration tests (Vitest)
npm run test:e2e  # end-to-end tests (Playwright; run `npm run build` first; uses Chromium)
npm run lint
```


Admin: `DATA_DIR=... node server/dist/admin.js reports | unhide <deckId> | hide <deckId>` (reported decks are hidden from the gallery until reviewed).

## Layout

- `shared/`: protocol types, zod schemas, and the pure table reducer used by the server (and by the client for prediction)
- `server/`: Fastify + `ws` server, SQLite persistence, deck and image services
- `client/`: React + Vite mobile-first web app
- `e2e/`: Playwright end-to-end tests
- `docs/`: deck manifest format and other docs
- `openspec/`: specifications and change proposals
