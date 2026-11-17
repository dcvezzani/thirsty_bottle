# Tasks

## 1. Verification

- [x] 1.1 Add an e2e test in `e2e/identity.spec.ts`: player A sits at a table and copies the recovery code; a fresh context enters it under "Continue with a recovery code" and sees A's name and seat. Verify that the test passes.
- [x] 1.2 Add an e2e assertion that an unknown code shows "Unknown recovery code" and leaves the picker open. Verify that the test passes.

## Workflow follow-up

- Archive the change once its tests pass on `main`.
