import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { LibraryImage } from '@vct/shared';

const images: LibraryImage[] = [
  { id: 'a', name: 'Goblin Archer', addedAt: 3, uses: { cards: 3, deckBacks: 0, decks: 2 } },
  { id: 'b', name: 'goblin shaman', addedAt: 2, uses: { cards: 0, deckBacks: 0, decks: 0 } },
  { id: 'c', name: 'Orc', addedAt: 1, uses: { cards: 0, deckBacks: 1, decks: 1 } },
];
const api = vi.fn(async (method: string, url: string) => {
  if (method === 'GET' && url.startsWith('/api/library/images')) return images;
  return { ok: true };
});
vi.mock('../lib/api', () => ({ api: (...a: any[]) => (api as any)(...a), imageUrl: (id: string) => `/img/${id}` }));

const { ImageLibrary } = await import('./ImageLibrary');

afterEach(cleanup);
const names = () => screen.queryAllByRole('listitem').map((li) => li.querySelector('.img-name')!.textContent);

describe('ImageLibrary (2.1)', () => {
  it('searches by name ignoring case, and filters to this deck', async () => {
    const deck = { id: 'd1', content: { cards: [{ id: 'x', name: 'X', count: 1, metadata: {}, frontImageId: 'a' }], backImageId: 'c' } };
    render(<ImageLibrary mode="manage" deck={deck} />);
    await waitFor(() => expect(names()).toEqual(['Goblin Archer', 'Orc']));
    // live counts: server (other decks) + this deck
    expect(screen.getByText('4 cards')).toBeTruthy();
    expect(screen.getByText('2 deck backs')).toBeTruthy();
    expect(api).toHaveBeenCalledWith('GET', '/api/library/images?exceptDeck=d1');
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(names()).toEqual(['Goblin Archer', 'goblin shaman', 'Orc']);
    fireEvent.change(screen.getByLabelText('Search images'), { target: { value: 'GOB' } });
    expect(names()).toEqual(['Goblin Archer', 'goblin shaman']);
  });

  it('pick mode returns the tapped image', async () => {
    const onPick = vi.fn();
    render(<ImageLibrary mode="pick" onPick={onPick} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Use Orc' }));
    expect(onPick).toHaveBeenCalledWith(images[2]);
  });

  it('an image in use shows where and cannot be deleted; an unused one can', async () => {
    render(<ImageLibrary mode="manage" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Goblin Archer' }));
    expect(screen.getByText('Used by 3 cards in 2 decks')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Delete' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'goblin shaman' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('DELETE', '/api/library/images/b'));
  });

  it('rename saves the trimmed name', async () => {
    render(<ImageLibrary mode="manage" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Orc' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: ' Orc Chief ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('PATCH', '/api/library/images/c', { name: 'Orc Chief' }));
  });

  it('select mode creates cards in the order tapped', async () => {
    const onCreate = vi.fn();
    render(<ImageLibrary mode="manage" onCreateCards={onCreate} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Create cards…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select Orc' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select Goblin Archer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create 2 cards' }));
    expect(onCreate.mock.calls[0][0].map((i: LibraryImage) => i.id)).toEqual(['c', 'a']);
  });
});
