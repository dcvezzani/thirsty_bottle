# Tasks

## 1. Server: library storage and rules

- [ ] 1.1 Add migration 4 for `library_images`, and the idempotent backfill (D1, D4). Verify with server tests:
  - a fresh database has the table
  - a database with an existing deck gets library rows named "Cruiser (front)" and "Deck back"
  - re-running the backfill adds nothing
- [ ] 1.2 Update `images.ts` so `referenced()` includes library images and `canFetch` allows library holders (D2). Verify with tests:
  - a library-only image survives `gc(0)`
  - a second player who imported the same picture can fetch it
  - a stranger still gets 404
- [ ] 1.3 Make `POST /api/images` accept `name` and upsert a library row. Add `GET /api/library/images` with use counts, `PATCH` to rename, and `DELETE` with the 409 `IN_USE` guard (D3), with shared zod schemas. Verify with server tests:
  - list, rename, re-import with no duplicate, and each player's own listing
  - deleting a used image returns 409 with counts
  - deleting an unused image removes it and its file after gc

## 2. Client: library, import and picker

- [ ] 2.1 Build the `ImageLibrary` component: thumbnail grid, names, use counts, search, a deck filter, and pick and select modes, with rename and delete in manage mode (D5). Verify with unit tests for search filtering, the deck filter, and showing the in-use message on delete.
- [ ] 2.2 Build the `ImportQueue`: multi-file input, client checks, two uploads at a time, "N of M" progress, and a failure list. Verify with unit tests using a mocked api: one bad file is reported and the rest are uploaded.
- [ ] 2.3 Add "Choose from images..." to `ImagePicker`, and send the file name on upload. Use it for the card front, card back and deck back. Verify with a unit test that picking sets the id, and confirm existing deck e2e tests still pass unchanged.
- [ ] 2.4 Add the `/images` page and an "Images" link from the decks page, and add the deck editor's Images section with "This deck" and "All" (D6). Verify with e2e tests in 3.1.
- [ ] 2.5 Add "Create cards from images": select mode, then "Create N cards" appends cards named after the images, with the images as fronts and pinned defaults (D5). Verify with a unit test of the card-building function, including pins and order.

## 3. End-to-end and checks

- [ ] 3.1 Add `e2e/image-library.spec.ts`:
  - import 3 PNGs plus one bad file, and see 3 in the library with the bad one reported
  - rename one
  - set a card front from the library
  - create 2 cards from images, and check their names and fronts
  - delete an unused image
  - deleting a used image is refused with its usage
  - a second player cannot see the first player's library
- [ ] 3.2 Add the Images page and the library picker sheet to `e2e/contrast.spec.ts`. Full lint, unit and e2e runs are green, including the existing decks, export/import and image access tests.

## Workflow follow-up

- Push to main to deploy, verify the live version, then archive the change.
