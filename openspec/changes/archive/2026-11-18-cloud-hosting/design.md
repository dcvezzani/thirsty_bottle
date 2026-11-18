# Design

## Context

See proposal.md. The app is one Node 22 process (`server/src/main.ts`) serving the client, REST API and WebSocket on one port (`server-hosting` spec). It stores SQLite, images and `secret.key` under `DATA_DIR` (`server/src/db.ts`, `server/src/images.ts`, `server/src/app.ts`). It depends on native modules (`better-sqlite3`, `sharp`) with prebuilt binaries for linux-x64 glibc. Table sessions are in memory with timers, but restart-safe: `Tables.loadAll()` restores from snapshots plus the action log and re-arms grace timers, and SIGINT/SIGTERM trigger `app.close()`, which writes snapshots. The client derives `ws`/`wss` from `location.protocol` (`client/src/store/app.ts`). Today Fastify does not trust proxy headers, so `req.protocol` is `http` behind a TLS proxy. That affects export URLs in `server/src/deckio.ts`.

## Goals / Non-Goals

**Goals:**
- The lowest monthly cost that keeps every feature, with automated CI/CD, deployable from a Claude session.

**Non-Goals:**
- Horizontal scaling or multi-region (the app is single-instance by design).
- Staging environments or preview deploys per pull request (possible later).
- A managed database or object storage.

## Decisions

### D1. Fly.io, one machine with a volume, scale to zero
| Option | Cost / month | Why not chosen |
| --- | --- | --- |
| **Fly.io, auto-stop and auto-start, 1 GB volume** | about $0.15 volume plus compute only while players are connected (est. $0–3) | chosen |
| Render free | $0 | no persistent disk and sleeps: decks and tables would be lost |
| Render starter + disk | about $7.25 | always on, so it costs more for idle hobby use |
| Railway | $5 minimum | higher floor |
| Oracle Always Free VM | $0 | self-managed VM, OS patching and TLS, signup friction |
| Cloudflare Durable Objects / PartyServer | about $0–5 | needs a rewrite: no `better-sqlite3`/`sharp`, different process model |
Scale to zero is safe because state is durable and restored on start. WebSockets keep the machine running while anyone is connected.

### D2. Container image
A multi-stage `node:22-bookworm-slim` build. Stage 1 runs `npm ci`, then `npm run build` with `GIT_SHA` as a build argument. Stage 2 runs `npm ci --omit=dev --workspace server --include-workspace-root=false`. If workspace pruning proves fragile, it copies `node_modules` from stage 1 and runs `npm prune --omit=dev`. It copies `server/dist`, `shared/dist`, `client/dist` and the package manifests. It runs as the non-root `node` user with `ENV NODE_ENV=production PORT=8080 DATA_DIR=/data GIT_SHA=$GIT_SHA` and `CMD ["node", "server/dist/main.js"]`. `.dockerignore` excludes `node_modules`, `data`, `.e2e-data*`, `test-results`, `.git` and `openspec`.

### D3. `fly.toml`
- `app` and `primary_region` are set from the repository variables.
- `kill_signal = "SIGINT"` and `kill_timeout = "20s"` give snapshots time to write.
- `[http_service]`: `internal_port = 8080`, `force_https = true`, `auto_stop_machines = "stop"`, `auto_start_machines = true`, `min_machines_running = 0`. Concurrency type `connections` (soft 200, hard 250), so WebSockets count as activity.
- `[[http_service.checks]]`: `GET /api/health` every 30s.
- `[[mounts]]`: `source = "cardtable_data"`, `destination = "/data"`.
- `[[vm]]`: `size = "shared-cpu-1x"`, `memory = "512mb"`. `sharp` needs headroom for 10 MB uploads; 256 MB risks out-of-memory kills.
- Exactly one machine: the volume attaches to a single machine and sessions are in memory. Deploys use the default `rolling` strategy, which with one volume means stop and then start.

### D4. Proxy awareness and version
`Fastify({ trustProxy: true, … })`. The server is only ever reached through the platform proxy in production, and locally there is no proxy, so trusting proxy headers changes nothing there. `/api/health` returns `{ ok: true, version: process.env.GIT_SHA ?? 'dev' }`.

### D5. CI (`.github/workflows/ci.yml`)
- Triggers: `push` (all branches) and `pull_request`.
- Steps: `actions/setup-node` with `node-version-file: .nvmrc` and the npm cache, `npm ci`, `npm run lint`, `npm run build`, `npm test`, `npx playwright install --with-deps chromium` (version from the lockfile, 1.63), and `npm run test:e2e`. Traces stay off; on failure, `test-results/` is uploaded.
- A `fly.toml` check: `superfly/flyctl-actions/setup-flyctl` runs `flyctl config validate --config fly.toml`. This needs no token for local validation; if it does, the step is skipped when `FLY_API_TOKEN` is unavailable (forks).

### D6. Deploy (`.github/workflows/deploy.yml`)
- Triggers:
  - `workflow_run` on CI with `types: [completed]` and `branches: [main]`, running only when `conclusion == 'success'`.
  - `workflow_dispatch` with input `ref` (default `main`).
- `concurrency: { group: production, cancel-in-progress: false }`.
- Steps:
  1. Check out the target ref.
  2. Resolve the SHA.
  3. Run `flyctl deploy --remote-only --app $FLY_APP --build-arg GIT_SHA=$SHA`, with `env: FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}`.
  4. Smoke check: poll `https://$FLY_APP.fly.dev/api/health` for up to 60 s until `version == $SHA`, otherwise fail.
  5. Write the deployed SHA and URL to the job summary.
- Manual deploys skip the CI gate on purpose, so a rollback is always possible. The runbook says to deploy only refs that passed CI.

### D7. Deploying from a Claude session
- The normal path is to push to `main`; CI and the automatic deploy follow.
- An explicit deploy or rollback goes through the GitHub MCP tool `actions_run_trigger` (workflow `deploy.yml`, `ref` input). The session then polls `actions_list`/`actions_get` and reads `get_job_logs` on failure, and reports the smoke-check result and URL.
- The session needs no Fly credentials; the GitHub App needs Actions read and write permission.
- `docs/deploy.md` documents this, with a short pointer in `README.md`.

### D8. Backups
Fly volumes have automatic daily snapshots, retained for 5 days by default (`fly volumes snapshots list`). Restoring means creating a new volume from the snapshot (`fly volumes create cardtable_data --snapshot-id … --region …`), destroying or detaching the old machine's volume, and redeploying. This is documented step by step in `docs/deploy.md`.

## Risks / Trade-offs

- **[Cold start delay (about 1–3 s) after idle]** → The client already shows "Connecting…" and retries; durable state means no data loss.
- **[Single region, single machine]** → Pick the region nearest the players. Downtime during deploys is about 10–30 s, and players reconnect automatically within the 2-minute grace period.
- **[Usage-based billing with no hard cap]** → One shared-cpu machine is pinned in config, and the docs say to check billing after the first week.
- **[Native module binaries on a different libc]** → Use the glibc-based bookworm-slim image, not Alpine.
- **[E2E flakiness on CI runners]** → Run with 1 worker as locally. If a test is timing-sensitive on CI, fix the test; never skip or quarantine it.
- **[Fly pricing or API changes]** → The design stays portable: the same Dockerfile runs on any container host with a volume.

## Migration Plan

This is a first deploy, so there is no data to migrate. Players' laptop-hosted data stays local; to move decks, export them as `.zip` and import them on production. Rollback means running the deploy workflow with the previous ref. To stop hosting entirely, run `fly apps destroy` after exporting decks.
