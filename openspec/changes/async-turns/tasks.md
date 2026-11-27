## 1. Pass the turn to absent players

- [ ] 1.1 In the reducer, make the turn-mode pass (`endTurn`, `autoPass`, and the active player leaving) choose the next seat with a player regardless of connection; keep the turn on the only seated player. Unit tests for an offline next seat, a single seat, a reversed direction and a skipped empty seat.

## 2. Keep seats and close idle tables

- [ ] 2.1 Add the `idleDays` setting (1 to 30, default 1, host only, validated) to the shared schema, defaults and the settings action, with unit tests for range and permissions.
- [ ] 2.2 In the server, arm the seat-grace expiry only in real-time mode, switch the timers on a mode change, limit the empty-table close to real-time tables, and add the per-table idle timer re-armed on each action, setting or mode change and rebuilt after a restart. Server tests with short timers for each scenario. Include a restart test (a table past its lifetime closes on load, one with time left keeps the remainder) and a test that a 30-day lifetime does not fire early.

## 3. Client and verification

- [ ] 3.1 Add the host's "Inactive table lifetime (days)" field to the table settings sheet, shown to players read-only, using the shared limits.
- [ ] 3.2 Add e2e tests: End turn with two players moves the indicator; with the next player offline the turn moves to them and they keep their seat after the grace period. Run lint, unit and the full e2e suites.
