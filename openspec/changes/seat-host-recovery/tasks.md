# Tasks

## 1. Verification

- [ ] 1.1 Add reducer tests: a player leaving with cards produces a `vacated` entry, and rejoining without `seatId` takes that seat even when an earlier empty seat exists. Verify that the tests pass.
- [ ] 1.2 Add reducer tests: after the host and everyone else leave, the next `seatJoin` makes the joiner host; when the host leaves, the longest-seated connected player becomes host. Verify that the tests pass.

## Workflow follow-up

- Archive the change once its tests pass on `main`.
