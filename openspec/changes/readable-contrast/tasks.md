# Tasks

## 1. Contrast check

- [ ] 1.1 Add `e2e/contrast.ts` with `lowContrast(page, opts)` (WCAG luminance, effective-background resolution, 4.5 / 3.0 thresholds, card elements excluded). Verify by writing a small Playwright test that injects a white-on-white button into a page and checks that the helper reports it with its ratio.
- [ ] 1.2 Add `e2e/contrast.spec.ts` covering the screens and states in design D3 (light and dark, iPhone 13 and 1280×800). Verify that the spec passes on current `main`.
- [ ] 1.3 Verify that the spec guards the original bugs: temporarily revert the `.sheet` color and the `color: var(--ink)` base rule in `client/src/styles.css`, confirm the spec fails and names the Draw sheet and counter controls, then restore the rules and confirm it passes again.

## 2. Documentation

- [ ] 2.1 Add a short "Styling rules" note to the README: surfaces own their text color (design D1), and run `npx playwright test e2e/contrast.spec.ts` after style changes. Verify that the documented command runs as written.

## Workflow follow-up

- Archive the change after the contrast spec is merged and passing.
