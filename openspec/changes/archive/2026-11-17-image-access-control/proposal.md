# Proposal

## Why

Uploaded artwork is access-controlled and image URLs carry a signed per-player key, but no spec states who may fetch an image. Without that, a future change to image serving could leak private artwork.

## What Changes

- Spec which players may fetch an image and how image requests are authorized.
- Extend tests to cover every access path.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `deck-library`: adds requirements (no existing requirement text changes).

## Impact

- `server/src/images.ts` (`canFetch`), `server/src/app.ts` (image route, `imageKey`): no code change expected.
- Tests in `server/test/decks.test.ts`.
