# Tasks

## 1. App changes for hosting

- [x] 1.1 Enable `trustProxy` in `server/src/app.ts` and add a server test that a JSON deck export requested with `X-Forwarded-Proto: https` has `https://` image URLs. Verify that the test passes.
- [x] 1.2 Return `version` (from `GIT_SHA`, default `dev`) from `/api/health`, and add a test with `GIT_SHA` set. Verify that the test passes.

## 2. Container

- [x] 2.1 Add `Dockerfile` (multi-stage, `node:22-bookworm-slim`, non-root, `PORT=8080`, `DATA_DIR=/data`, `GIT_SHA` build argument) and `.dockerignore`. Verify with `docker build` and by running the container with a mounted temp dir, where `/api/health` returns the build SHA and a deck can be created and survives a container restart. If Docker is unavailable in the session, verify through the CI image build in 3.1.

## 3. CI

- [ ] 3.1 Add `.github/workflows/ci.yml` (lint, build, unit and integration tests, Playwright e2e, a Docker image build without push, and `flyctl config validate`; upload `test-results/` on failure). Verify with a green run on a pushed branch, and fix any CI-only test failures in the tests themselves, never by skipping.

## 4. Fly configuration and deploy workflow

- [ ] 4.1 Add `fly.toml` per design D3. Verify that `flyctl config validate` passes in CI.
- [ ] 4.2 Add `.github/workflows/deploy.yml` (automatic after green CI on `main`, manual with `ref`, production concurrency group, remote build with `GIT_SHA`, health smoke check, job summary). Verify that the workflow file passes `actionlint` (run via `npx` or the action) in CI.
- [ ] 4.3 After the user's one-time setup, confirm the repository secret `FLY_API_TOKEN` and variables `FLY_APP` and `FLY_REGION` exist (names only), then trigger the first deploy from this Claude session with `actions_run_trigger`. Verify that the run succeeds and `https://<app>.fly.dev/api/health` reports the deployed SHA.

## 5. Documentation

- [ ] 5.1 Write `docs/deploy.md` covering:
  - one-time setup, with the checklist and links
  - how deploys happen
  - deploying and rolling back from a Claude session (tool calls and what to report)
  - checking status
  - backup and restore
  - cost and scaling limits

  Add a "Deploy" pointer in `README.md`. Verify that every command in the doc matches the workflow and config files.

## 6. End-to-end verification in production

- [ ] 6.1 On the public URL, two browsers onboard, create a table with the built-in deck, deal and pass cards. Then trigger a redeploy from a Claude session and confirm both players reconnect to the same table with the same hands, and that uploaded artwork still loads. Verify by recording the result in the change's notes.
- [ ] 6.2 Confirm idle behavior: after all players leave, the machine stops (`fly status` or the dashboard via the user), and the next visit starts it and shows existing decks. Verify through the user's screenshot or `fly status` output.

## Workflow follow-up

- Archive the change after production has been verified.
