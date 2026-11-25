## ADDED Requirements

### Requirement: Requesting to see a hand
A seated player viewing another player's table SHALL be able to ask to see that player's hand, from the viewed column or the player's seat sheet, while some of its cards are hidden from them. The owner SHALL get a prompt to allow or decline. A pending request SHALL end when answered, cancelled, when either player leaves their seat, or when the asker stops viewing that table. Spectators SHALL NOT be able to ask. Asking and answering SHALL work out of turn.

#### Scenario: Ask and wait
- **WHEN** Dave views George's table and taps "Ask to see hand"
- **THEN** George is prompted "Dave asks to see your hand" with Allow and Decline, and Dave's control reads "Asked…" until George answers or Dave cancels

#### Scenario: Decline
- **WHEN** George declines
- **THEN** Dave's view stays as it was, Dave is told George declined, and the log says so without naming any card

#### Scenario: Spectators cannot ask
- **WHEN** a spectator views George's table
- **THEN** no control to ask to see George's hand is offered, and the request is refused if sent

#### Scenario: Out of turn
- **WHEN** it is another player's turn in turn-based mode and Dave asks to see George's hand
- **THEN** the request is made and George can answer it

#### Scenario: Asker stops viewing
- **WHEN** Dave has a pending request and returns to his own table
- **THEN** the request ends and George's prompt goes away

### Requirement: Showing a whole hand
When the owner allows, every card currently in their hand SHALL be shown to the asker, exactly as showing those cards to that player. The asker SHALL see their fronts in the viewed fan and be able to scrub through them. Cards added to the hand later SHALL stay hidden, and a card that leaves the hand SHALL leave the reveal. The log SHALL say the hand was shown without naming cards, and the owner SHALL be able to stop showing their hand in one tap.

#### Scenario: Allow shows every front
- **WHEN** George allows Dave's request while holding 6 cards
- **THEN** Dave sees all 6 fronts in George's fan, can scrub through them, and the badge reads 6 shown

#### Scenario: A later card stays hidden
- **WHEN** George draws a seventh card after allowing
- **THEN** Dave sees 6 fronts and one back

#### Scenario: A played card leaves the reveal
- **WHEN** George plays one of the shown cards to the table
- **THEN** that card follows the table's face rules and Dave still sees the remaining shown fronts

#### Scenario: The owner stops showing
- **WHEN** George taps "Stop showing my hand"
- **THEN** Dave's view of George's hand returns to backs, and the eye marks on George's cards disappear
