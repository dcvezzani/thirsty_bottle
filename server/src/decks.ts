import type { TableDeck } from '@vct/shared';
import type { App } from './app.js';

/** Deck library service (filled in by the deck-library tasks). */
export class Decks {
  constructor(private app: App) {}
  hasNewerVersion(_d: TableDeck | undefined): boolean {
    return false;
  }
}
