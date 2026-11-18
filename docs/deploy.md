# Deploying Card Table

Production runs on [Fly.io](https://fly.io) as **one small machine with a 1 GB volume** (`thirsty-bottle`, region `dfw`): https://thirsty-bottle.fly.dev

- **Cost-saving idle stop:** the machine stops when nobody is connected and starts automatically on the next visit, which takes a few seconds.
- **Durable data:** decks, artwork, tables, chat and players live on the volume (`/data`). They survive deploys, restarts and idle stops.
- **Releases:** GitHub Actions does all releases. Nobody needs Fly credentials on their machine, and Claude sessions don't need them either.

## How deploys happen

| Trigger | What runs |
| --- | --- |
| Any push or pull request | **CI** (`.github/workflows/ci.yml`): lint, build, unit and integration tests, Playwright e2e, a container image build with a smoke test, actionlint, and `fly.toml` validation |
| CI succeeds for a push to `main` | **Deploy** (`.github/workflows/deploy.yml`) runs automatically for that commit |
| Manual (**Actions → Deploy → Run workflow**, `gh workflow run deploy.yml -f ref=<ref>`, or a Claude session) | **Deploy** for any branch, tag or commit: use it to redeploy or roll back |

Deploy runs `flyctl deploy --remote-only --ha=false` (Fly's builders build the `Dockerfile`, with the commit SHA baked in as `GIT_SHA`). It then polls `https://thirsty-bottle.fly.dev/api/health` until that endpoint reports the deployed commit, and fails otherwise. Only one deploy runs at a time; a second one waits.

> Manual deploys don't wait for CI, so a rollback is always possible. Only deploy refs that have passed CI.

## Deploying from a Claude session

A Claude session uses the GitHub tools; it never holds the Fly token.

- **Normal release:** commit and push to `main`. CI runs, and Deploy follows automatically if CI passes.
- **Explicit deploy or rollback:**
  1. `actions_run_trigger` with `method: run_workflow`, `workflow_id: deploy.yml`, `ref: main` and `inputs: { ref: "<branch | tag | commit SHA>" }`. For a rollback, use the last good commit SHA (shown in the summaries of earlier Deploy runs).
  2. `actions_list` with `method: list_workflow_runs` and `resource_id: deploy.yml`: find the new run.
  3. `actions_get` with `method: get_workflow_run`: wait for `status: completed`.
  4. If it failed, run `get_job_logs` with `run_id` and `failed_only: true` to see why.
  5. Report the result, the deployed commit, and the URL.
- **Checking what's live:** `GET https://thirsty-bottle.fly.dev/api/health` returns `{ "ok": true, "version": "<commit>" }`.

## One-time setup (already done for `thirsty-bottle`)

1. Create a Fly.io account (https://fly.io/app/sign-up) and add a payment method under Billing at https://fly.io/dashboard.
2. Install `flyctl` (https://fly.io/docs/flyctl/install/), then run `fly auth login`.
3. Create the app and its volume:
   ```bash
   fly apps create thirsty-bottle
   fly volumes create cardtable_data --size 1 --region dfw --app thirsty-bottle
   ```
4. Create a deploy token with `fly tokens create deploy --app thirsty-bottle --expiry 8760h`, and save it as the repository secret **`FLY_API_TOKEN`** (Settings → Secrets and variables → Actions).
5. Add the repository variables **`FLY_APP`** = `thirsty-bottle` and **`FLY_REGION`** = `dfw`.
6. Allow GitHub Actions (Settings → Actions → General).
7. Give the Claude GitHub App **Actions: read & write** permission (https://github.com/apps/claude/installations/select_target), so sessions can run Deploy.

The token expires after one year. Renew it with step 4 and replace the secret.

## Status and logs

```bash
fly status --app thirsty-bottle          # machine state (started / stopped)
fly logs --app thirsty-bottle            # live server logs
fly releases --app thirsty-bottle        # deploy history
```

Or use the dashboard at https://fly.io/apps/thirsty-bottle.

## Backups and restore

Fly snapshots the volume **daily** and keeps the snapshots for **5 days**.

```bash
fly volumes list --app thirsty-bottle                     # note the volume id (vol_…)
fly volumes snapshots list <vol_id>                       # pick a snapshot id
```

To restore a snapshot:

1. Create a volume from the snapshot:
   ```bash
   fly volumes create cardtable_data --snapshot-id <snapshot_id> --region dfw --size 1 --app thirsty-bottle
   ```
2. Destroy the old machine and its old volume, so the app has exactly one `cardtable_data` volume:
   ```bash
   fly machines list --app thirsty-bottle
   fly machines destroy <machine_id> --force --app thirsty-bottle
   fly volumes destroy <old_vol_id> --app thirsty-bottle
   ```
3. Redeploy (Actions → Deploy → Run workflow with `ref: main`, or ask a Claude session). The new machine mounts the restored volume.

To move decks out of production, export them as `.zip` from the deck page (decks can be imported anywhere).

## Cost and limits

- **Volume:** 1 GB, about $0.15/month.
- **Compute:** one `shared-cpu-1x` machine with 512 MB, billed only while it runs (while players are connected, plus a few minutes before the idle stop). Expect roughly $0–3/month for friends-sized games.
- **No hard spending cap:** Fly has none, so check Billing in the dashboard after the first week.
- **Keep it at one machine:** don't scale beyond one (`fly scale count 1`). Tables live in that machine's memory and the volume attaches to a single machine.
- **Cold start:** the first visit after an idle stop takes a few seconds. Clients show "Connecting…" and resume on their own.
