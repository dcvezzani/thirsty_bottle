## ADDED Requirements

### Requirement: Guest players on a phone
The host SHALL be able to add guest players to a table from their own device, each with a name and a colour and no sign-in. A guest SHALL take a normal seat, count toward the seat limit, and have a private hand. A guest SHALL exist only for that table and SHALL be removed when the table closes or the host removes it.

#### Scenario: Add a guest
- **WHEN** the host adds a guest named Sam with a colour
- **THEN** Sam takes the next free seat and every participant sees a seat for Sam

#### Scenario: Seat limit
- **WHEN** the host adds a guest to a table whose seats are all taken
- **THEN** the guest is refused with "All seats are taken"

#### Scenario: Remove a guest
- **WHEN** the host removes a guest
- **THEN** the guest's seat is released like a player who left, and its identity is removed from the phone

#### Scenario: Table closes
- **WHEN** the table closes
- **THEN** its guests and their identities are removed

### Requirement: One identity at a time
A phone with guests SHALL be connected as one person at a time. Only the connected person's hand SHALL be sent to the phone, and other guests' hands SHALL never be on the device.

#### Scenario: Another guest's hand
- **WHEN** Kim is the connected person on the phone
- **THEN** the phone holds Kim's view only, and Sam's hand is not on the device

### Requirement: Handoff to the next person on the phone
In turn-based mode, when a turn ends and the next seat belongs to a person on this phone, the screen SHALL show a full cover naming that person, with no cards visible, and the phone SHALL switch to that person's identity. The person SHALL reveal their view with a tap.

#### Scenario: Pass the phone
- **WHEN** Kim ends her turn and the next seat is Sam, a guest on the same phone
- **THEN** the phone shows "Pass the phone to Sam" with no cards visible, and Sam's hand appears only after Sam taps

#### Scenario: Cover before reveal
- **WHEN** the cover is showing
- **THEN** no hand, zone or log of the previous person is visible

### Requirement: Waiting for a remote turn
In turn-based mode, while the turn belongs to a player on another device, the phone SHALL show a cover naming that player and SHALL NOT show a hand. When the turn returns to a person on this phone, the handoff cover SHALL appear.

#### Scenario: Remote player's turn
- **WHEN** Sam ends his turn and the next seat is Alex on her own phone
- **THEN** the shared phone shows "Waiting for Alex" with no hand, and when the turn comes back to a guest it shows the handoff cover

### Requirement: Switching in real-time mode
In real-time mode there SHALL be no automatic handoff. A "Who's playing" switcher SHALL let the person on the phone switch to another guest by hand, showing a cover first.

#### Scenario: Manual switch
- **WHEN** a person on the phone chooses Kim in the switcher during a real-time game
- **THEN** the phone shows a cover for Kim and switches to Kim's view when she taps

### Requirement: Guests among other players
Other participants SHALL see a guest's seat as a normal seat. While a guest is not the connected person on a phone, the seat SHALL be marked "on a shared phone" and not "disconnected". Guests SHALL NOT appear in the lobby's list of players.

#### Scenario: Seat marking
- **WHEN** Sam is a guest and Kim is the connected person on the shared phone
- **THEN** remote players see Sam's seat marked "on a shared phone"

### Requirement: Lost guest identity
If a guest's identity is lost from the phone, the host SHALL see that guest marked as not on this phone and SHALL be able to remove it. Removing a guest whose seat holds cards SHALL leave the seat vacated with its cards kept, for the host to resolve.

#### Scenario: Phone storage cleared
- **WHEN** the phone's storage is cleared while Sam is a guest
- **THEN** the host's list of players on this phone marks Sam as not on this phone, and removing Sam frees the seat, or vacates it with Sam's cards kept
