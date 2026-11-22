# Proposal

## Why

Setups are private to their owner. A host can't share a game setup with friends, discover setups others have made, or start from a ready-made one for common games. The deck library already solves these problems for decks (visibility, gallery, share links, cloning others' work, reports, built-ins), so setups should follow the same patterns. That keeps them consistent and reuses familiar flows. This completes the second half of the table-setups work.

## What Changes

- **Setup visibility:** private (default), link (anyone with the share link) or public (also in the gallery), changed only by the owner, as for decks. Archived setups are not viewable through links or the gallery.
- **Setup gallery:**
  - a Gallery tab on the Setups page, listing active public setups with name, owner, player range, zone count and clone count;
  - search by name or owner, and sort by newest or most cloned;
  - open a setup read-only, then clone it or report it.
- **Share links:** `/s/<token>` opens a read-only view of a link or public setup, with Clone and, when the viewer hosts a table, **Use at my table**.
- **Cloning others' setups:** any setup you can view can be cloned into your library as an independent private setup, labelled "Cloned from <setup> by <owner>". Cloning your own keeps "<name> (copy)".
- **Using shared setups at a table:**
  - the host can apply any setup they can view: their own, built-in, public, or link-shared via its link;
  - the Apply setup sheet lists the host's setups, the built-in ones, and a search of the public gallery;
  - Play again keeps working while the host can still view that setup.
- **Default decks the host can't use:** a slot whose default deck the host can't use asks for another deck when applying. A fixed deal whose locked deck the host can't use is refused with a clear message. The owner is warned when publishing a setup whose default decks others can't use.
- **Reports:**
  - any player who can view a public setup that is not built in can report it, with an optional reason;
  - a report hides it from the gallery until an operator reviews it, and repeat reports by the same player have no extra effect;
  - the existing admin command-line tool lists reported setups alongside decks and can hide or unhide them.
- **Built-in setups:** read-only setups for everyone, using the built-in Standard 52 deck, that can be applied and cloned:
  - **Klondike:** 1 player;
  - **Hearts:** 3 to 6 players, all cards dealt;
  - **Crazy Eights:** 2 to 7 players; 7 cards each for 2 players, otherwise 5; one card face up to start the discard pile.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `table-setups`:
  - "Setup library" no longer defers sharing.
  - "Applying a setup" allows any setup the host can view.
  - New requirements cover visibility, the gallery, share links, cloning others' setups, built-in setups, reports and admin review of setup reports.

## Impact

- **Server:**
  - a migration adds to setups: `visibility`, `share_token`, `built_in`, `hidden`, `clone_count`, `cloned_from_label`, plus a `setups_fts` search table and `setup_reports`;
  - the setups service gains one view-access check (owner, built-in, public, link), plus gallery, visibility, share, report and seeded built-ins;
  - applying uses the access check instead of owner-only;
  - `admin.ts` gains setup reports, hide and unhide.
- **Shared:** visibility and owner fields on setup summaries and details.
- **Client:**
  - a Gallery tab and a read-only setup view (with Clone and Report);
  - visibility controls in the editor, with the default-deck warning;
  - a share link page `/s/<token>`;
  - Built-in and Gallery sections in the Apply setup sheet.
- **Tests:** server tests for access rules, the gallery and search, sharing, cloning, reports and the admin tool, built-ins, and applying shared setups. e2e tests for publishing, finding and applying a gallery setup from another player, a share link, report hiding, the built-in Klondike, and contrast.
