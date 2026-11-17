# Proposal

## Why

The app is an installable PWA, and updates apply on the next launch instead of reloading a page mid-game (a fix made after the auto-reload dropped `?newPlayer`). No spec covers installability, update behavior or what the offline cache may serve.

## What Changes

- New `app-shell` capability: installability, update timing, and offline-cache boundaries.
- Add tests for update timing and cache contents.

## Capabilities

### New Capabilities
- `app-shell`: Defines how the web app installs and updates on devices: installability, when new versions take effect, and what the offline cache may serve.

### Modified Capabilities

None. Requirements are added only; no existing requirement changes.

## Impact

- `client/vite.config.ts` (`vite-plugin-pwa`, `registerType: 'prompt'`, `navigateFallbackDenylist`), `client/src/main.tsx`: no code change expected.
- Tests in `e2e/identity.spec.ts`.
