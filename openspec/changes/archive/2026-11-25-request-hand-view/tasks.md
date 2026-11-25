# Tasks

## 1. Rules

- [x] 1.1 Add `seeRequests` to the table state and the actions `seeAsk`, `seeRespond` and `seeCancel`, allowed out of turn, with the approval acting as a show of the whole hand, the logs, and the clean-up on leaving a seat, reset and applying a setup (D1 to D3). Verify with reducer unit tests: asking creates one request and logs it; a duplicate is ignored; a spectator or a self-request is refused; allowing shows every hand card to the asker only and logs publicly without names, and privately with names for the asker; declining logs; a card added later stays hidden; a moved card leaves the reveal; cancelling works; a seat leaving drops requests both ways; asking and answering work in turn mode out of turn.

## 2. Server and wire

- [x] 2.1 Report see-requests in the projection with `kind` (D4), and cancel the asker's pending request when their viewing changes (D2). Verify with a server test: Dave asks George, George's view has an incoming see-request and Dave's an outgoing one, Allow makes George's hand cards known to Dave only, and Dave's `table.view` change drops a pending request.

## 3. Client

- [x] 3.1 Add the ask control (viewed column and seat sheet), the waiting banner with Cancel and the owner's prompt (D5). Verify with unit tests of when the control is offered (seated, hidden cards, none pending, pending shows "Asked…") and of the prompt text.
- [x] 3.2 Add "Stop showing my hand" in the owner's hand while any card is shown, sending `unshow` for every hand card (D3b, D5). Verify with a unit test.

## 4. End-to-end and checks

- [x] 4.1 Add `e2e/request-hand-view.spec.ts`: Dave views George and asks; George is prompted and allows; Dave sees every front and scrubs one; a later draw stays a back; George taps "Stop showing my hand" and Dave sees backs again; a decline leaves backs and notifies Dave; cancelling and returning to his own table drop a pending request; a spectator has no ask control.
- [x] 4.2 Update `e2e/contrast.spec.ts` for the ask control, the banner and the prompt. Full lint, unit and e2e runs are green.

## Workflow follow-up

- Push to main to deploy, verify the live version, then archive the change.
