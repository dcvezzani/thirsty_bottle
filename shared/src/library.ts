import { z } from 'zod';

/** One image in a player's private image library (image-library). */
export interface LibraryImage {
  id: string;
  name: string;
  addedAt: number;
  /** Use in the player's own decks (current version, or the unsaved draft when there is one). */
  uses: { cards: number; deckBacks: number; decks: number };
}

export const LibraryImageName = z.string().trim().min(1).max(100);
export const RenameLibraryImage = z.object({ name: LibraryImageName });

/** The display name for an uploaded file: its name without the extension. */
export function imageNameFromFile(fileName: string | undefined): string {
  const stem = (fileName ?? '').replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '').trim();
  return stem && stem !== 'blob' ? stem.slice(0, 100) : 'Image';
}
