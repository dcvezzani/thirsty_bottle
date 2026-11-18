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

## Idle stop (task 6.2), 2026-11-18

`fly status --app thirsty-bottle` (run by the owner) after a quiet period:

```
 PROCESS │ ID             │ VERSION │ REGION │ STATE   │ ROLE │ CHECKS             │ LAST UPDATED
 app     │ d8de177f656d48 │ 13      │ dfw    │ stopped │      │ 1 total, 1 warning │ 2026-11-18T18:38:18Z
```

The machine had stopped on its own with nobody connected. The health check shows a warning because nothing answers it while the machine is stopped; that is expected.

The next visit woke it up:

- First request to `/api/health`: HTTP 200 in 4.6 s (cold start). The second request took 0.4 s.
- A new player reached the lobby, and the New table dialog listed the built-in decks (Standard 52, and Standard 52 + Jokers).
- Saved data on the volume survived restarts, as shown by the live game across a redeploy above (task 6.1).
