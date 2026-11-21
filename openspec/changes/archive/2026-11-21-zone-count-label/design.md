# Design

## Context

- The label is a single button: `{zone.name} <span className="muted">· {n}</span>`. In fit-width zones, `.zone.w-fit .zone-label` sets `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` on the whole button, so the ellipsis eats the end of the text, which is the count.
- Fit-width zones on a phone can be as narrow as about 48px (a 40px card plus 8px of chrome) when seven columns share a row.

## Goals / Non-Goals

**Goals:**
- The count is never cut off; only the name shortens.

**Non-Goals:**
- A count badge on column cards (considered in exploration and set aside).
- A face-down / face-up split count.
- Changing the label's accessible name. It stays "{name} actions", which many tests and screen-reader users rely on. Announcing the count is a possible follow-up.

## Decisions

**D1. Two-part label.**
- The button becomes a flex row containing:
  - `<span class="zone-name">{name}</span>`, with `min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap`;
  - `<span class="zone-count">· {n}</span>`, with `flex: none; white-space: nowrap`.
- The ellipsis rules move from the button to the name span, for every width, not only fit. A long name in a half-width zone should shorten the same way.
- *Alternative rejected:* putting the count first ("27 · Standard…"). It reads oddly and changes a label players already know.

**D2. Tight zones.**
- Inside a fit zone the label already uses 12px text and 2px side padding.
- At the narrowest, about 44px of label space, "· 12" takes about 22px, which leaves the name room for one or two letters plus the ellipsis. That's acceptable: the name is still in the zone sheet's title.
- The count never wraps, and the button's height doesn't change.

## Risks / Trade-offs

- [Very narrow zones show almost none of the name] → The count is the more useful part at a glance, and the full name is one tap away in the zone sheet. Arrange mode shows names on tiles at least 108px wide.
- [e2e tests that read label text] → Existing tests locate labels by their accessible name ("P1 actions"), which is unchanged.
