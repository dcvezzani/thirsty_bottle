## MODIFIED Requirements

### Requirement: Scrubbing a column
Pressing and sliding along a column SHALL temporarily open up the cards below the finger's card so they can be read; the finger's card and every card above it stay where they are, and cards further away stay compressed. The card under the finger SHALL always be the card shown in the loupe and previewed in the column. On release the column SHALL return to its compressed form, with nothing changed. Paint selection SHALL work during a column scrub as it does in rows. With a mouse, hovering over a column SHALL open up the cards under the pointer in the same way.

#### Scenario: Read a compressed card
- **WHEN** a player slides a finger down a compressed column and stops on the 4th card
- **THEN** the 4th card is opened up enough to read, and on release the column is compressed again and the selection is unchanged

#### Scenario: The card under the finger is the card shown
- **WHEN** a player slides a finger down a column of 12 cards, including face-down ones, and stops on the 7th card
- **THEN** the loupe shows the 7th card, which is the card drawn under the finger

#### Scenario: Scrubbing back up
- **WHEN** the player then slides the finger back up the column to the 3rd card
- **THEN** the loupe shows the 3rd card, which is the card drawn under the finger, and at no point does the shown card jump ahead of the finger

#### Scenario: Nothing moves under the finger
- **WHEN** the scrub moves onto another card
- **THEN** the cards above the new card are where they were in the compressed column
