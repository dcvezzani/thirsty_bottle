# Proposal

## Why

When scrubbing a column, the card shown in the loupe is sometimes not the card under the finger, mostly for cards in the middle of the column. The column is drawn with the cards around the finger opened up, but the card under the finger is found from the compressed column. The opening also pushes cards down by up to about 100 px, so the card that is drawn under the finger is not the one the program thinks it is, and the loupe shows the wrong card. Rows do not have this problem.

## What Changes

- **The card under the finger is the card shown.** While scrubbing a column, the card the loupe shows and the card previewed in the column are always the card physically under the finger.
- **Opening happens below the finger's card only.** The cards below the focused card open up to be read; the focused card and every card above it stay where they are, so nothing moves under the finger and the card found at a position is the card drawn there. Mouse hover opens the column in the same way.
- **Unchanged.** A compressed column at rest, release returning it to compressed, paint selection, and picking up from a column.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `card-handling`: "Scrubbing a column" now opens only the cards below the finger's card and requires the card under the finger to be the card shown. Its existing scenario stays.

## Impact

- **Client only.** The column opening function, the column's hit test, and the hover handler. No server, shared-rules or protocol change.
- **Tests:** the existing unit test that expects the card above the focus to open changes; new unit tests for a stable scrub up and down; an e2e test that the loupe's card is the card under the finger at each step of a scrub down a long column.
