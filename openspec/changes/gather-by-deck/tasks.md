# Tasks

## 1. Rules

- [ ] 1.1 Add optional `deck` to the `gather` action schema. In the reducer, filter to that deck's cards, turn only that deck's cards in the target face down, clear reveals only on them, refuse an unknown deck, and log "gathered N <deck> cards" (D1 to D3). Verify with reducer unit tests:
  - two decks spread over zones and a hand: only deck A moves, and deck B keeps its zones and faces
  - a shown deck-B card stays shown
  - an unknown deck is refused
  - gather all is unchanged

## 2. Client

- [ ] 2.1 Add "Gather <deck> here" buttons to the zone sheet when 2 or more decks are loaded, hidden on other players' zones (D4). Verify with e2e tests in 3.1.

## 3. End-to-end and checks

- [ ] 3.1 Add `e2e/gather-by-deck.spec.ts`:
  - load two decks, draw cards of both into a hand and a zone
  - "Gather <deck A> here" collects only deck A, and the counts match
  - with one deck loaded, no per-deck button appears
- [ ] 3.2 Full lint, unit and e2e runs are green.

## Workflow follow-up

- Push to main to deploy, verify the live version, then archive the change.
