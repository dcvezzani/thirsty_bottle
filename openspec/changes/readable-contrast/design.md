# Design

## Context

See proposal.md. The table screen sets `color: #fff` so labels read on the felt. CSS `color` inherits, and the base rule for form controls was `color: inherit`. Any light-background control or sheet placed inside the table therefore rendered white on white. The fix (already on `main`) changed the base rule for `button, input, select, textarea` to `color: var(--ink)`, gave `.sheet` an explicit `color: var(--ink)`, and set the placeholder color to `var(--ink-2)`. Felt-specific buttons (`.topbar button`, `.seat`, `.selection-bar button`, `.counter button`, `.drawer-tabs button`, `.turn-bar button`, `.zone-label`) already set their color explicitly with more specific selectors, so they keep white text.

## Goals / Non-Goals

**Goals:**
- Turn the fixes into a guarded requirement with an automated check that would have caught both regressions.

**Non-Goals:**
- A full accessibility audit (keyboard navigation, screen-reader labels, motion preferences). This change covers contrast only.
- Visual redesign or new themes.

## Decisions

### D1. Surfaces own their text color
Any element that paints a background is responsible for its own text color: controls use `--ink`, panels and sheets use `--ink`, and the felt uses white. This makes readability local and independent of where an element is placed.
**Alternative considered:** overriding colors inside `.table-screen` per component. Rejected because it is whack-a-mole: every new control on the felt would need its own override.

### D2. Contrast measured in the browser with WCAG luminance
`e2e/contrast.ts` exports `lowContrast(page)`. It walks visible elements that own text (direct text nodes) and form controls, and resolves the effective background by walking up to the first ancestor with a background at least 50% opaque. It computes the WCAG 2.x contrast ratio and returns offenders with element, text and ratio. Thresholds: 4.5 for normal text, 3.0 for large text and placeholders. The check runs on real rendered pages in Playwright, so it sees computed styles, inheritance and dark mode exactly as users do.
**Alternatives considered:** a static stylesheet linter, which cannot see inheritance or runtime state such as open sheets; and axe-core. axe is a good option, but its color-contrast rule skips many dynamically positioned overlays and adds a dependency. The focused helper is small and has no dependencies. axe can still be adopted later without changing the spec.

### D3. Screens and states covered
Light and dark color schemes at iPhone 13 and 1280×800: the lobby (all tabs), the create-table sheet, the deck editor with the card form open, and the table with the zone sheet, the Draw sheet, the counters (empty and typed), the Info drawer, the seat sheet and the card info sheet. Elements whose background is an image (card art) are excluded, because their contrast depends on user artwork.

### D4. Control boundaries
The first run of the check found field and outlined-button borders at about 1.5:1 (they used the decorative `--line` color) and filled red buttons at 2.7:1 against the dark panel. A separate `--control-line` token is used for control borders (light `#8a8577`, dark `#8b8b80`) so list dividers keep the subtle `--line`. In dark mode the accent becomes `#e0263f`, which is 3:1 or more against the panel while white labels stay at 4.5:1 or more.

### D5. Player colours are data, not text colours
Players pick any colour, so colour-on-panel text cannot guarantee contrast. Names render in `--ink` with the colour shown as a dot, and labels drawn on a player-colour background pick black or white text by luminance (`inkOn`).

## Risks / Trade-offs

- [Gradient felt backgrounds make the "effective background" approximate] → Use the felt's darkest base color as the fallback background. White text on that fallback has a ratio above 9:1, so the approximation is not a source of false passes for light text.
- [False positives on decorative text such as the copy badge over card art] → Exclude descendants of `[data-h]` card elements and `img` overlays, and document the exclusion.
