# Decks: format and lifecycle

## Lifecycle

| State | What you can do |
| --- | --- |
| **Draft** | Edits in the deck editor are kept as an unsaved draft, which survives reloads. Only you see it. **Save** makes it the deck's new version. **Discard** returns to the last saved version. |
| **Active** | Appears in your library and in the table deck picker. Others see only the last *saved* version. |
| **Archived** | Hidden from your library's main view, the deck picker and the gallery, and share links stop working. **Restore** brings it back unchanged. |
| **Deleted** | Only an archived deck can be permanently deleted, after you confirm. Clones of it and tables already using it are not affected. |

**Visibility** (owner only):

- **Private** (default): only you, plus players at a table where the deck is loaded.
- **Link**: anyone with the share link (`/d/<token>`) can view and clone it.
- **Public**: also listed in the gallery, which is searchable by deck name or owner.

**Clone** makes an independent private copy that you own, from any deck you can view: your own, built-in, public or link-shared decks, or a deck loaded at your table. A clone of someone else's deck shows "Cloned from *deck* by *owner*". Later edits, archiving or deletion of the original never change the clone.

**Tables play from a snapshot.** Loading a deck onto a table copies its current saved version, so editing, archiving or deleting the deck never changes a game in progress. The host sees when a newer version exists and can reload it. Each copy of a card is numbered when loaded (for example "Goblin #2 of 3"). The number is visible only to players who can see the card's face.

**Reporting.** Anyone can report a public deck, which hides it from the gallery until reviewed (each player's report counts once; built-in decks can't be hidden). The deck's owner still has it in their library. A server operator reviews reports with the admin tool, pointed at the server's data directory:

```bash
DATA_DIR=./data node server/dist/admin.js reports          # reported decks, counts and reasons
DATA_DIR=./data node server/dist/admin.js unhide <deckId>  # back in the gallery, reports cleared
DATA_DIR=./data node server/dist/admin.js hide <deckId>    # hide without a report
```

**Export / import** are for backups, moving decks between servers, and offline authoring. You can export any deck you can view. Importing always creates a new private deck that you own.

## Manifest format

Export produces either a `.zip` (`deck.json` + `images/`) or a single `.json` manifest whose images are URLs. Import accepts:

- a `.zip` with `deck.json` at its root and images referenced by their path inside the archive
- a `.json` manifest whose image references are `https://` URLs or `data:image/...;base64,` URLs

```text
{
  "format": "card-table-deck",      // required, exactly this
  "version": 1,                     // required
  "name": "Deck name",              // 1-100 chars
  "description": "optional",
  "back": "<image ref>",            // optional deck-wide back image
  "propertyTemplate": [             // optional: suggested metadata keys for the editor
    { "key": "suit", "type": "text" }   // type: text | number | boolean | list
  ],
  "cards": [
    {
      "id": "optional-stable-id",
      "name": "Card name",          // required, 1-100 chars
      "description": "optional",
      "count": 3,                   // number of copies, 1-500 (default 1)
      "front": "<image ref>",       // optional; without it a text face is generated
      "back": "<image ref>",        // optional; falls back to the deck back
      "metadata": { "suit": "Hearts", "rank": 12, "royal": true, "tags": ["a", "b"] },
      "abilities": [                // optional, descriptive only (never executed)
        { "trigger": "On Play", "effect": "Draw Card", "value": 2, "target": "Self" }
      ]
    }
  ]
}
```

Metadata values may be text, numbers, booleans or lists of text. Images are normalized to a 750×1050 (2.5:3.5) WebP card frame without distortion, and may be PNG, JPEG or WebP up to 10 MB each.

If any card is invalid, the import is refused and the errors are reported per card, for example `card 1 "Negative": count: Number must be greater than or equal to 1`.

### Sample

```json sample
{
  "format": "card-table-deck",
  "version": 1,
  "name": "Monster Brawl (sample)",
  "description": "A tiny sample deck.",
  "propertyTemplate": [
    { "key": "power", "type": "number" },
    { "key": "faction", "type": "text" }
  ],
  "cards": [
    {
      "name": "Goblin",
      "count": 3,
      "description": "Small, sneaky and numerous.",
      "front": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAHCAIAAABPxRC5AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVR4nGNQWpWGjBhozAcAHnsp14hZ6DIAAAAASUVORK5CYII=",
      "metadata": { "power": 1, "faction": "Greenskins" },
      "abilities": [{ "trigger": "On Play", "effect": "Draw Card", "value": 1, "target": "Self" }]
    },
    {
      "name": "Troll",
      "count": 1,
      "metadata": { "power": 5, "faction": "Greenskins", "tags": ["big", "slow"] }
    }
  ]
}
```
