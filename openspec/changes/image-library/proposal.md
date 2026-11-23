# Proposal

## Why

Card artwork can only be added one slot at a time. Each front, back and deck back has its own picker, and every image goes through upload and preview separately. Building a deck from a folder of artwork means dozens of separate uploads, and a card back used by several decks has to be uploaded again for each one. Images can't be imported ahead of time either. An uploaded image that no deck uses is deleted by cleanup after an hour, and filenames are never kept, so a pool of images couldn't be browsed even if it survived.

## What Changes

- **Image library per player.** It holds the images that player has imported or uploaded. Each image has a name, which defaults to its filename and can be renamed. The library is private to its owner, and the automatic image cleanup never removes library images.
- **Bulk import.** Several files can be picked at once, including a phone photo-library multi-select. Each file is validated and normalised as uploads are today. Progress shows per file, and a failed file is listed with its reason while the rest still import.
- **Library views.** The library appears in the deck editor ("This deck" / "All"), on its own Images page, and in a picker that searches by name.
- **Picking from the library.** The card front, card back and deck back controls gain "Choose from images...". The current upload-with-preview stays, and anything uploaded that way also joins the library.
- **Create cards from images.** Selecting N library images creates N cards in the open deck. Each card is named after its image and uses the image as its front. The card pins from card-form-remember (copies, properties, back) apply as the defaults for the new cards.
- **Rename and delete.**
  - An image can be renamed.
  - An image can be deleted only when no deck version, draft or loaded table uses it. A used image shows where it is used ("Used by 3 cards in 2 decks").
- **Backfill.** Existing images are added to their players' libraries: images a player uploaded, plus images their decks use. Their names come from the card that uses them, e.g. "Cruiser (front)", or "Deck back".

## Capabilities

### New Capabilities

- `image-library`: a player's private collection of imported images, covering import, naming, browsing, the picker, creating cards from images, deletion rules and retention.

### Modified Capabilities

- `deck-library`: "Image access" also serves an image to players whose library holds it. (Uploads joining the library is specified in `image-library`.)

## Impact

- **Server:**
  - migration 4 adds a `library_images` table (player, image, name, added_at)
  - `server/src/images.ts`: cleanup keeps library images, and access counts library ownership
  - new routes: list, rename, delete and usage
  - `POST /api/images` accepts an optional name and adds the image to the library
  - a backfill step in the migration
- **Client:**
  - `ImagePicker` gains library choice
  - a new `ImageLibrary` component, used in the deck editor and on an `/images` page
  - a "Create cards from images" sheet
  - a multi-file import queue
- **Shared:** zod schemas for library rows.
- **No change** to deck content, export/import format, or table snapshots.
