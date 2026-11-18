# Spec Delta

## Purpose

Defines how Card Table is built, verified and released to production, and how production behaves: CI checks, automatic and manual deploys, rollback, deploy observability, data durability, idle cost behavior, backups and secret handling.

## ADDED Requirements

### Requirement: Continuous integration
Every push and every pull request SHALL run lint, the full build, the unit and integration tests, and the end-to-end browser tests. Any failing step SHALL mark the run as failed and SHALL prevent that commit from deploying automatically.

#### Scenario: Failing test blocks deploy
- **WHEN** a commit pushed to `main` fails one end-to-end test
- **THEN** the CI run fails and production is not updated to that commit

#### Scenario: Pull request checks
- **WHEN** a pull request is opened against `main`
- **THEN** the same checks run and their result is shown on the pull request

### Requirement: Automatic deploy from main
When CI passes for a commit on `main`, production SHALL be updated to that commit. Only one deploy SHALL run at a time; a newer deploy SHALL wait for the running one to finish.

#### Scenario: Green commit on main
- **WHEN** CI succeeds for the latest commit on `main`
- **THEN** that commit is deployed to production without manual steps

### Requirement: Manual deploy and rollback
An authorized person or a Claude session SHALL be able to deploy any branch, tag or commit to production by triggering a deploy workflow with that ref (default `main`), without shell access to the host.

#### Scenario: Roll back
- **WHEN** a deploy introduces a problem and the deploy workflow is triggered with the previous good commit
- **THEN** production runs the previous commit, and all data is intact

### Requirement: Deploys are observable
Each deploy SHALL report success or failure together with the deployed commit. Production SHALL expose the running version (commit) in its health endpoint, and a deploy SHALL count as successful only when the health endpoint reports the deployed commit.

#### Scenario: Smoke check
- **WHEN** a deploy finishes
- **THEN** the workflow requests the production health endpoint and fails unless it responds with `ok` and the deployed commit

### Requirement: Data survives deploys, restarts and idle stops
Decks, artwork, tables (including hands), chat history and player identities SHALL persist across deploys, restarts and idle stops of production.

#### Scenario: Deploy mid-game
- **WHEN** a new version is deployed while a table is in progress
- **THEN** players reconnect to the same table with the same cards once the new version is running

### Requirement: Idle cost minimization
Production SHALL stop its compute when no players are connected, and SHALL start automatically on the next request. Players SHALL wait at most a few seconds on that first request, and clients SHALL then behave as for any reconnect.

#### Scenario: First visit after idle
- **WHEN** a player opens the site after it has been idle for hours
- **THEN** the app loads after a short start-up delay and all data is present

### Requirement: Backups
The production data volume SHALL be snapshotted at least daily, with at least 5 days of snapshots retained. A documented procedure SHALL restore production from a chosen snapshot.

#### Scenario: Restore
- **WHEN** an operator follows the restore procedure with yesterday's snapshot
- **THEN** production runs with the data as of that snapshot

### Requirement: Deploy credentials stay out of the repository and sessions
The production deploy credential SHALL be stored only as a CI secret. It SHALL NOT appear in the repository, logs or Claude sessions. Claude sessions SHALL deploy by triggering the CI deploy workflow.

#### Scenario: Claude deploys
- **WHEN** a Claude session is asked to deploy
- **THEN** it triggers the deploy workflow through the GitHub integration and reports the result, without holding the host's credentials
