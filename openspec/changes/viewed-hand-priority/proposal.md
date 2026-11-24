# Proposal

## Why

While viewing another player's table, two hand areas are stacked at the bottom: the viewed player's hand as a row of tiny cards, and the viewer's own full-size hand. Both are often empty, so the bottom of a phone screen holds two empty boxes. The viewed hand's empty message also reads "Your hand is empty", which is wrong. The viewed hand is the point of the view: a player who shows cards to another needs the viewer to see them clearly, and tiny cards are unreadable.

## What Changes

- **The viewed hand takes the main hand slot**, at the same size and fan as the viewer's own hand, with the cards shown to the viewer first and face up.
- **Hidden cards collapse.** Cards the viewer cannot see form one small stack labelled with their count ("+3 hidden"), instead of a full row of backs.
- **Nothing shown, one slim line.** When no card is shown to the viewer, the viewed hand is a single slim line ("Dave's hand · 5 · none shown to you"). When a card is shown, it grows to the full hand size.
- **Empty message names the owner.** An empty viewed hand reads "Dave's hand is empty", never "Your hand is empty".
- **The viewer's own hand becomes a slim strip** while viewing another table: one line, "Your hand · 5", with small cards. Dragging a card from it still passes it onto the viewed player's zones. It returns to full size when the viewer returns to their own view.
- **Spectators** get the same enlarged viewed hand for the seat they are viewing.
- **Unchanged:** tapping a card in the viewed hand offers the existing take or ask actions.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `table-play`: "What another player's view shows" is changed so the viewed hand is prominent and the viewer's own hand is a slim strip.

## Impact

- **Client:**
  - `client/src/pages/Table.tsx`: the hand slot while viewing
  - `client/src/table/CardRow.tsx`: the empty message by owner, and ordering and collapsing of hidden cards
  - `client/src/styles.css`: the slim hand strips
- **Tests:**
  - `e2e/player-views.spec.ts` and `e2e/contrast.spec.ts` for the new layout
  - a new test that a shown card is readable in the viewed hand
- **No server or protocol changes.**
