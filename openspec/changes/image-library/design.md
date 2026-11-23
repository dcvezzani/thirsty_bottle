# Design

## Context

- **Storage:** images are stored content-addressed by sha256 (`server/src/images.ts`), as `<id>.webp` plus a thumbnail. The `images` table has a single `owner_id`, set by the first uploader, because inserts use `INSERT OR IGNORE`.
- **Cleanup:** `gc()` keeps only images whose ids appear in deck versions, drafts or table decks. Other images are removed after a one-hour grace period.
- **Access:** `canFetch` allows the owner, a viewer of a deck that uses the image, or a seated player at a table that uses it.
- **Client:** `ImagePicker` (in `DeckEditor.tsx`) previews a file, posts it to `POST /api/images`, and returns an id. It is used for the deck back and for a card's front and back.
- **Card pins:** card-form-remember keeps pinned new-card values in localStorage under `vct.cardPins.<deckId>`.

## Goals / Non-Goals

**Goals:**
- Bulk import, then pick: images are not lost before they are used.
- Existing upload, preview, remove and access behavior is unchanged for everything already working.

**Non-Goals:**
- Sharing libraries between players, folders or tags, or image editing (crop, rotate).
- Changing deck content, the export/import format, or table snapshots.
- Zip import into the library (deck import already handles zips).

## Decisions

**D1. A `library_images` table, separate from `images`.**
- Migration 4: `library_images(player_id, image_id, name, added_at, PRIMARY KEY(player_id, image_id))`, indexed by player.
- `images` stays the physical store, and the library is a per-player membership with a name. This fixes first-uploader ownership: two players can each hold the same image.
- Alternative considered: add `name` to `images`. Rejected, because a shared content-addressed row can't carry a per-player name.

**D2. Cleanup and access.**
- `referenced()` also includes every `image_id` in `library_images`.
- `canFetch` returns true when `library_images` has `(playerId, id)`. This sits beside the existing owner check, which is kept for images uploaded before the backfill.

**D3. API.**
- `POST /api/images` gets an optional multipart `name` field, the client-sent filename stem trimmed to 100 characters. After ingest it upserts a library row. A re-import keeps the existing name and does not duplicate.
- `GET /api/library/images` returns `[{ id, name, addedAt, uses: { cards, deckBacks, decks } }]` for the caller.
  - Usage is computed by scanning the caller's own deck drafts and current versions for the id. That is per player, so it stays a cheap scan.
  - The response also carries `inUseAnywhere`, which checks all versions, drafts and table decks. That flag gates deletion.
- `PATCH /api/library/images/:id` takes `{ name }` to rename.
- `DELETE /api/library/images/:id` returns 409 `IN_USE` with the counts when the image is used anywhere. Otherwise it removes the row and runs `gc()` for that id.
- Bulk import is a client-side queue of single `POST /api/images` calls, run two at a time. The multipart `files: 1` limit is kept, so per-file errors map directly to the queue.

**D4. Backfill inside migration 4.**
- The migration's SQL creates the table. A post-migration step in `db.ts` (run once, keyed by migration version) does the backfill:
  1. Insert `(owner_id, id, 'Image')` for owned images.
  2. For each deck, by owner, scan its current version and draft JSON. Upsert library rows named `"<card name> (front)"`, `"<card name> (back)"` or `"Deck back"`. A name taken from a card replaces the "Image" placeholder.
- The backfill is idempotent, using upserts.

**D5. Client components.**
- `ImageLibrary` lists images in a grid of thumbnails with name and use count. It has search and an optional deck filter, and supports select mode (multi-select) and pick mode (single). The `/images` page and the deck editor's Images section both use it.
- `ImagePicker` gains a "Choose from images..." button that opens `ImageLibrary` in pick mode in a sheet. The preview-and-upload flow is unchanged, but the upload now sends the file name.
- `ImportQueue` is a hidden `<input type="file" multiple accept=...>`. It does client-side type and size checks first, then runs the uploads and shows "7 of 12" with a list of failures.
- "Create cards from images": in select mode in the deck editor, a "Create N cards" button builds a `CardDef` per selected image.
  - Each card is named after its image and uses it as the front.
  - Its other fields come from `prefill(loadPins(deckId), template)` (card-form-remember) for count, description, back, properties and abilities. Name is taken from the image.
  - The cards are appended to the draft through the existing `update`.

**D6. Navigation.** The decks page gets an "Images" link to `/images`. The deck editor's Images section is collapsible and sits above the card list, with the "This deck" view selected by default.

## Risks / Trade-offs

- [Libraries grow without bound] → Owners can delete images. Storage is already capped per upload. The image count is shown on the Images page.
- [Usage scan cost for large accounts] → It scans only the caller's decks for counts. The global in-use check runs only on delete, using indexed lookups with `LIKE` the same way `canFetch` already does.
- [Backfill naming is approximate] → Names can be edited, and "Image" is a fallback.
- [The uploader's filename may contain personal info] → Names are visible only to the owner, and are never added to deck content or exports.

## Migration Plan

- Migration 4 plus the backfill run at startup.
- Rollback: the table is additive and old code ignores it. Library-only images left unreferenced would be collected by the old cleanup after rollback, which is acceptable.
