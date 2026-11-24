# Proposal

## Why

"Gather all here" pulls every card on the table into one zone. When two decks are loaded at once, for example a game deck plus a separate deck of tokens or roles, players often want to collect one deck for the next round and leave the other where it is. Today that means moving the other deck's cards back by hand.

## What Changes

- **Per-deck gathering.** With two or more decks loaded, a zone's sheet offers "Gather <deck> here" for each deck, next to "Gather all here". It moves only that deck's cards into the zone, from every zone, hand and per-player copy.
- **Other decks left alone.** A deck gather turns only the gathered deck's cards face down, and ends shows and peeks only on those cards. Other decks' cards, including any already in the target zone, keep their face and reveals.
- **Logging.** The log names the deck: "Alex gathered 96 Monopoly Deal cards into Draw pile".
- **Gather all unchanged.** "Gather all here" works exactly as before. With one deck loaded, only "Gather all here" is shown.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `table-play`: "Gather and reset" gains gathering a single deck's cards.

## Impact

- **Shared:** the `gather` action gains an optional `deck` (table deck id). The reducer filters the cards and limits the face-down change and reveal clearing to them. A missing deck is refused.
- **Client:** `ZoneSheet` in `client/src/table/Sheets.tsx` gets the per-deck buttons. They are hidden on other players' zones, like "Gather all here".
- **No server or storage changes:** the action is validated by the existing schema.
