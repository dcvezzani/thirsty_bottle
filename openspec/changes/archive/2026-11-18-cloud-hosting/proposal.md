# Proposal

## Why

Card Table only runs on a laptop today, so games stop when the laptop sleeps, and friends need Wi-Fi tricks or a tunnel to join. The goal is an always-reachable HTTPS address at the lowest cost that still supports every feature: persistent decks and artwork, durable tables, and long-lived WebSockets. Releases should be automated, and a Claude session should be able to deploy.

## What Changes

- Package the app as a container image (multi-stage Dockerfile) that runs the existing single-process server.
- Host on Fly.io: one small machine with a 1 GB persistent volume for `DATA_DIR`. It stops when no players are connected and starts automatically on the next visit.
- Make the server proxy-aware (HTTPS behind the platform proxy) and report its deployed version from `/api/health`.
- GitHub Actions CI on every push and pull request: lint, build, unit and integration tests, and the Playwright e2e suite.
- Automatic production deploy after CI passes on `main`, plus a manual deploy and rollback workflow that takes any ref.
- A runbook for deploying, rolling back and checking status from a Claude session, using the GitHub workflow tools with no host credentials in the session.
- Daily volume snapshots as backups, with a documented restore procedure.

## Capabilities

### New Capabilities
- `deployment`: The CI/CD pipeline and production hosting: what CI checks, when and how production deploys, rollback, observability of deploys, data durability across deploys and idle stops, backups, and secret handling.

### Modified Capabilities
- `server-hosting`: adds a requirement for correct behavior behind an HTTPS reverse proxy (no existing requirement text changes).

## Impact

- **New files:** `Dockerfile`, `.dockerignore`, `fly.toml`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `docs/deploy.md`.
- **Code:** `server/src/app.ts` (Fastify `trustProxy`; `/api/health` returns `version`), plus a pointer in `README.md`.
- **External:** a Fly.io account with a payment method, and one Fly app and volume. GitHub repository secret `FLY_API_TOKEN` and variables `FLY_APP` and `FLY_REGION`. The Claude GitHub App needs Actions read and write permission.
- **Cost:** about $0.15/month for the volume plus usage-based compute while players are connected, an estimated $0–3/month for friends-sized play.
