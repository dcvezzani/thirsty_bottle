# Design

## Context

- **Setups today** (`server/src/setups.ts`, migration 2 in `server/src/db.ts`):
  - the `setups` table has `owner_id TEXT NOT NULL`, `status`, `current_version_id`, `cloned_from_setup_id`;
  - versions and drafts work like decks;
  - every read is owner-only (`owned()`), and `applyToTable` refuses setups the host doesn't own.
- **The deck library is the pattern** (`server/src/decks.ts`):
  - `visibility` is private, link or public, with a `share_token`;
  - `canView()` is the single access check: owner, builtin, public (unless hidden), link with the token, or `table` (loaded on a table the viewer is at);
  - `gallery()` searches the `decks_fts` table (FTS5, prefix terms), sorted by newest or clone count, and excludes hidden and built-in decks;
  - `clone()` labels clones of others' decks "Cloned from X by Owner" and increments `clone_count`;
  - `report()` inserts into `deck_reports` (once per reporter) and sets `hidden = 1` unless built in;
  - `/api/share/:token` resolves a link;
  - built-ins are seeded at startup (`DeckIO.seedBuiltIns`, ids `builtin-standard-52/54`);
  - `server/src/admin.ts` lists reports and hides or unhides decks.
- **Client:**
  - `pages/Setups.tsx` (library, editor);
  - `table/SetupSheets.tsx` (Apply setup, Save table as setup);
  - `pages/Decks.tsx` and `pages/DeckEditor.tsx` (gallery tab, viewer, share page `/d/:token`) as UI patterns.

## Goals / Non-Goals

**Goals:**
- Deck-equivalent sharing for setups: visibility, gallery, links, cloning others', reports, admin review, built-ins.
- Hosts can apply any setup they can view.

**Non-Goals:**
- Ratings, comments or collections.
- Automatically sharing the decks a setup uses. Decks keep their own visibility; slots fall back to "choose a deck".
- Versioned pinning when applying someone else's setup. Applying always uses that setup's current saved version.

## Decisions

**D1. Migration 3 extends `setups` and adds search and reports.**
- New columns: `visibility TEXT DEFAULT 'private'`, `share_token TEXT UNIQUE`, `built_in INTEGER DEFAULT 0`, `hidden INTEGER DEFAULT 0`, `clone_count INTEGER DEFAULT 0`, `cloned_from_label TEXT`.
- New tables: `setups_fts(setup_id UNINDEXED, name, owner_name)` and `setup_reports(setup_id, reporter_id, reason, at, PRIMARY KEY(setup_id, reporter_id))`.
- Built-ins use `owner_id = ''`, because the column is NOT NULL and SQLite can't relax it without rebuilding the table. They're shown as owned by "Card Table".

**D2. One access check, `canView(id, playerId, shareToken?)`**, mirroring decks:
- `owner`;
- `builtin`;
- `public` (active and not hidden);
- `link` (active, link or public, token matches);
- `table`: the setup is the `lastSetup` of a table the player is at. This lets participants see and clone it, and the host Play again, without the share token.

Reads (`detail`), `clone`, `report` and `applyToTable` use it. Edits (draft, save, archive, delete, visibility) stay owner-only. Non-owners get a read-only detail without the draft.

**D3. Gallery and share.**
- `GET /api/setup-gallery?q&sort&offset&limit` uses the same query shape as the deck gallery: public, active, not hidden, not built in, with FTS prefix matching on name and owner. `setups_fts` is reindexed on create, save and rename, and removed on delete.
- `PUT /api/setups/:id/visibility` creates a share token the first time a setup is made link or public.
- `GET /api/setup-share/:token` resolves a link to a read-only detail.
- `GET /api/setups` also returns `builtIn: SetupSummary[]` for the active status, as decks do.

**D4. Default-deck warnings.**
- Summaries and details include, per slot, `defaultDeckShareable`: the default deck is built in, public or link.
- The editor's visibility control warns when making a setup link or public while any slot's default isn't shareable.
- Applying is unchanged: a slot whose deck the host can't load already fails with "choose another". The Apply sheet pre-selects only defaults the host can load (it asks the server per slot through the summary) and requires a choice for the others.
- For a fixed deal whose locked deck the host can't view, `applyToTable` refuses with "This setup's fixed deal needs {owner}'s deck".

**D5. Cloning others' setups.** `clone(id, playerId, token?)`:
- the source must pass `canView`;
- for others' setups (or built-ins), the content keeps its name and the clone records `cloned_from_label = "Cloned from {name} by {owner}"`;
- the source's `clone_count` goes up.
- Cloning your own keeps the "(copy)" suffix.

**D6. Reports and admin.**
- `POST /api/setups/:id/report` inserts into `setup_reports` (`INSERT OR IGNORE`) and sets `hidden = 1 WHERE built_in = 0`.
- `admin.ts`:
  - `reports` prints two tables, decks then setups;
  - `hide` and `unhide` decide by id prefix: `st_` or `builtin-setup-` is a setup, anything else a deck.
  - `unhide` clears that item's reports.

**D7. Built-in setups.**
- `Setups.seedBuiltIns()` runs at startup after the deck built-ins, with ids `builtin-setup-klondike`, `builtin-setup-hearts` and `builtin-setup-crazy-eights`, owner `''`, `built_in = 1`, public, using `SetupContent` with slot default `builtin-standard-52`.
- A missing setup is created. One whose current content differs from the code writes a new version, so built-ins can be corrected in later releases.
- **The contents:**
  - **Klondike:** players 1–1. Stock (pile, the deck's home), Waste, F1–F4 piles, then P1–P7 columns with P1 starting a new row and Pk dealing k−1 face down and 1 face up.
  - **Hearts:** players 3–6. A Stock pile as the deck's home (normally empty after the deal), a Trick spread, hands of `rest`, and a per-seat counter "{name} points" at 0.
  - **Crazy Eights:** players 2–7. Stock (pile, home), Discard (pile, 1 face up), and hands of `{byPlayers: [2:7, 3-7:5]}`.

**D8. Client.**
- **Setups page:** tabs My setups, Archived and Gallery. The gallery has search and sort, plus a Built-in list under My setups, as decks have.
- **Read-only view:** opening a setup you don't own shows the same editor sections disabled, with Clone and Report (Report for public, non-built-in setups only) and a "Cloned from …" label.
- **Owner editor:** gains a Visibility select (Private, Link, Public) with the share link and Copy button, and the default-deck warning.
- **`/s/:token`** shows the read-only view.
- **Use at my table** appears on any setup page whenever the viewer hosts a table, whether the setup is theirs, someone else's, or built in. It opens the table's Apply sheet with the setup preselected. On your own setup it is disabled while there are unsaved changes ("Save first"), because tables use the last saved version. It is hidden for archived setups. Added after review: the first version showed it only for others' setups.
- **Apply setup sheet:** sections Your setups, Built-in, and Gallery (search).
- **Lobby New table setup select:** gains a "Built-in" group.

**D9. Play again remembers the decks.** Applying records, in the table's `lastSetup`, the source deck used for each slot. Play again sends those choices again. A host who had to pick their own deck for someone else's setup therefore isn't asked again, and Play again keeps working. Found while testing 2.2.

## Risks / Trade-offs

- [Abuse in the gallery] → The same report-and-hide flow and admin review as decks.
- [A public setup pointing at a private deck] → A warning for the owner. Others choose their own deck when applying.
- [Built-in content changes over time] → Seeding writes a new version only when the content differs. Tables that already applied it keep their state.
- [The `table` access rule widens what participants can see] → It matches decks, and only exposes the setup the table actually used.
