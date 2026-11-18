# Production verification notes

App: `thirsty-bottle` (Fly.io, `dfw`), https://thirsty-bottle.fly.dev

## Deploys (task 4.3)

| Run | Trigger | Commit | Result |
| --- | --- | --- | --- |
| [Deploy #2](https://github.com/dcvezzani/thirsty_bottle/actions/runs/44211485854) | automatic, after CI #2 passed on `main` | `7aa9d29` | success. Fly created 1 machine (`d8de177f656d48`); `/api/health` reported `7aa9d29…` |
| [Deploy #3](https://github.com/dcvezzani/thirsty_bottle/actions/runs/44211933020) | manual, from a Claude session (`actions_run_trigger`, `ref: main`) | `7aa9d29` | success |
| [Deploy #4](https://github.com/dcvezzani/thirsty_bottle/actions/runs/44212468828) | manual, from a Claude session, during a live game | `08cbbd4` | success |

CI #1 failed on shellcheck warnings (fixed in `7aa9d29`), and its Deploy run was correctly skipped.

## Live game across a redeploy (task 6.1), 2026-11-18

A Playwright script ran from the Claude session against production (the host was allowed through the session's `thirsty_bottle` environment). Two players:

1. Onboarded and sat at a new table with the built-in Standard 52.
2. Loaded a private deck with uploaded artwork.
3. Shuffled and dealt 5 each, flipped an art card face up on the Table, and passed one card from A to B.
4. Recorded hands before the deploy: A had 4 cards, B had 6.
5. While both were connected, Deploy #4 was triggered from the session. Both clients showed "Connection lost" at 01:01:17 and reconnected at 01:01:18 UTC.
6. Results after the deploy: same table, identical hands for both players, and the artwork displayed and reloaded fresh from the restarted server.

Output: `RESULT sameTable=true sameHands=true artLoads=true artLoadsAfterRestart=true`

The script then closed the table and deleted its test deck.

Leftovers from the script's first, aborted attempt: an unused private deck (`d__pnXKRWNLMnk`, owned by a throwaway test player) and a table that closes automatically after 30 minutes with nobody connected. Neither is visible to other players.

## Idle stop (task 6.2)

Pending: needs `fly status --app thirsty-bottle` showing the machine `stopped` after about 10 minutes with nobody connected. The next visit should start it and show existing decks.
