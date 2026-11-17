# Tasks

## 1. Contrast check

- [x] 1.1 Add `e2e/contrast.ts` with `lowContrast(page, opts)` (WCAG luminance, effective-background resolution, 4.5 / 3.0 thresholds, card elements excluded). Verify by writing a small Playwright test that injects a white-on-white button into a page and checks that the helper reports it with its ratio.
- [x] 1.2 Add `e2e/contrast.spec.ts` covering the screens and states in design D3 (light and dark, iPhone 13 and 1280×800). Verify that the spec passes on current `main`.
- [x] 1.4 Fix the control-boundary and remaining text failures the check found: a `--control-line` token for borders of fields and outlined buttons with at least 3:1 against panels in light and dark mode, a brighter dark-mode accent so filled red buttons reach 3:1 against the dark panel while white labels keep at least 4.5:1, and a theme-aware background in the image-picker placeholder. Verify that `e2e/contrast.spec.ts` passes in all four configurations.
- [x] 1.5 Fix player-colour text found by the full-suite run: chat author names use the panel ink with a coloured dot, and actor labels choose black or white text by the player colour's luminance. Verify with a unit test of the ink choice, and confirm that `e2e/contrast.spec.ts` passes when run after the other specs, with chat history present.
- [x] 1.3 Verify that the spec guards the original bugs: temporarily revert the `.sheet` color and the `color: var(--ink)` base rule in `client/src/styles.css`, confirm the spec fails and names the Draw sheet and counter controls, then restore the rules and confirm it passes again.

## 2. Documentation

- [x] 2.1 Add a short "Styling rules" note to the README: surfaces own their text color (design D1), and run `npx playwright test e2e/contrast.spec.ts` after style changes. Verify that the documented command runs as written.

## Workflow follow-up

- Archive the change after the contrast spec is merged and passing.
