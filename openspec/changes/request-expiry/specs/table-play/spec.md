## ADDED Requirements

### Requirement: Requests expire
A request to take cards from another player's hand, and a request to see a hand, SHALL expire five seconds after it is made if the owner has not answered. Expiry SHALL count as no answer: nothing is taken or shown, the owner's prompt closes, the asker's control returns so they can ask again, the log says the request expired, and the asker is told. An answer arriving after expiry SHALL be refused as expired. Expiry SHALL NOT end anyone's undo window.

#### Scenario: Unanswered take request
- **WHEN** Alex asks to take a card from Sam's hand and Sam does not answer for 5 seconds
- **THEN** Sam's prompt closes, the card has not moved, the log says the request expired, and Alex is told Sam did not answer in time

#### Scenario: Unanswered request to see a hand
- **WHEN** Dave asks to see George's hand and George does not answer for 5 seconds
- **THEN** George's prompt closes, Dave still sees backs, Dave's "Ask to see" control returns, and Dave is told George did not answer in time

#### Scenario: Late answer
- **WHEN** Sam taps Allow after the request has expired
- **THEN** nothing is taken or shown, and Sam is told the request has expired

#### Scenario: Ask again
- **WHEN** a request has expired
- **THEN** the asker can make the same request again immediately

#### Scenario: Undo survives an expiry
- **WHEN** Sam makes an undoable move 2 seconds after a request to Sam was made, and the request expires 3 seconds later
- **THEN** Sam can still undo the move

### Requirement: Request countdown
While a request is pending, the owner's prompt and the asker's waiting banner SHALL show the seconds left, counted from the remaining time the server reports so that differences between the devices' clocks do not matter. A request that was pending when the server restarted SHALL keep only the time it had left, and expire at once if it was already overdue.

#### Scenario: Countdown shown
- **WHEN** a request is pending
- **THEN** the owner's prompt shows a shrinking bar and the seconds left, and the asker's banner shows the seconds left, both counting down from about 5

#### Scenario: Clocks disagree
- **WHEN** the asker's device clock is a minute ahead of the owner's
- **THEN** both countdowns still end within a second of each other, when the server expires the request

#### Scenario: Server restart
- **WHEN** the server restarts 3 seconds after a request was made
- **THEN** the request expires about 2 seconds after the restart
