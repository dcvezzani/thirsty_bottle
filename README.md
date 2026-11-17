# Card Table

A rules-free virtual card table for playing any card game with friends over the network: classic games or ones you invent, with your own artwork. The server shuffles, deals and keeps hidden cards hidden. Everything else is up to the players, just like at a real table.

Mobile-first web app (installable as a PWA) + a single Node.js server.

## Requirements

- Node.js 22+
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

## Develop

```bash
npm run dev
```

Runs the server with auto-restart on port 3000 and the Vite dev server (with hot reload) on port 5173. Open http://localhost:5173. API and WebSocket calls are proxied to the server.

Tip: every browser tab can be a different player. Open several tabs, or add `?newPlayer` to a URL to create another player, to test multiplayer by yourself.

## Test

```bash
npm test          # unit + integration tests (Vitest)
npm run test:e2e  # end-to-end tests (Playwright, builds must be current: run `npm run build` first)
npm run lint
```

## Layout

- `shared/`: protocol types, zod schemas, and the pure table reducer used by the server (and by the client for prediction)
- `server/`: Fastify + `ws` server, SQLite persistence, deck and image services
- `client/`: React + Vite mobile-first web app
- `e2e/`: Playwright end-to-end tests
- `docs/`: deck manifest format and other docs
- `openspec/`: specifications and change proposals
