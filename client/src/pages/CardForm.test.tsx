import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useState } from 'react';
import type { CardDef } from '@vct/shared';
import { CardForm } from './DeckEditor';
import { loadPins, savePins } from '../lib/cardPins';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const tmpl = [{ key: 'suit', type: 'text' as const }];

/** Mirrors the deck editor: "Save & add another" remounts the form via a key. */
function Host({ spy, card = null }: { spy: (c: CardDef) => void; card?: CardDef | null }) {
  const [k, setK] = useState(0);
  const [last, setLast] = useState<string>();
  const [open, setOpen] = useState(true);
  if (!open) return <p>closed</p>;
  return (
    <CardForm
      key={k}
      card={card}
      template={tmpl}
      deckId="d1"
      lastName={card ? undefined : last}
      onClose={() => setOpen(false)}
      onRemove={() => {}}
      onSave={(c, next) => {
        spy(c);
        if (next) {
          setLast(c.name);
          setK(k + 1);
        } else setOpen(false);
      }}
    />
  );
}

const mount = (props: Parameters<typeof Host>[0]) =>
  render(
    <MemoryRouter>
      <Host {...props} />
    </MemoryRouter>,
  );
const name = () => document.getElementById('cname') as HTMLInputElement;
const copies = () => document.getElementById('ccount') as HTMLInputElement;
const suit = () => screen.getAllByLabelText('Property value')[0] as HTMLInputElement;

describe('CardForm pins', () => {
  it('pre-fills a new card from stored pins', () => {
    savePins('d1', { name: 'Goblin ', count: '3', props: [{ key: 'suit', type: 'text', value: 'hearts' }], abilities: [] });
    mount({ spy: vi.fn() });
    expect(name().value).toBe('Goblin ');
    expect(document.activeElement).toBe(name());
    expect(name().selectionStart).toBe(7);
    expect(copies().value).toBe('3');
    expect(suit().value).toBe('hearts');
    expect(screen.getByLabelText('Pin copies').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByLabelText('Pin description').getAttribute('aria-pressed')).toBe('false');
  });

  it('shows no pins when editing and leaves stored pins alone', () => {
    savePins('d1', { count: '3', props: [], abilities: [] });
    const spy = vi.fn();
    mount({ spy, card: { id: 'c1', name: 'Ace', count: 2, metadata: {} } });
    expect(screen.queryByLabelText(/^Pin /)).toBeNull();
    expect(screen.queryByText('Save & add another')).toBeNull();
    fireEvent.click(screen.getByText('Done'));
    expect(spy).toHaveBeenCalledOnce();
    expect(loadPins('d1').count).toBe('3');
  });

  it('Save & add another keeps the sheet open with pinned values, following the last save', () => {
    const spy = vi.fn();
    mount({ spy });
    fireEvent.click(screen.getByLabelText('Pin copies'));
    fireEvent.click(screen.getByLabelText('Pin property suit'));
    fireEvent.change(name(), { target: { value: 'Ace' } });
    fireEvent.change(copies(), { target: { value: '2' } });
    fireEvent.change(suit(), { target: { value: 'hearts' } });
    fireEvent.click(screen.getByText('Save & add another'));
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Ace', count: 2, metadata: { suit: 'hearts' } }));
    expect(name().value).toBe('');
    expect(copies().value).toBe('2');
    expect(suit().value).toBe('hearts');
    fireEvent.change(name(), { target: { value: 'Two' } });
    fireEvent.change(suit(), { target: { value: 'spades' } });
    fireEvent.click(screen.getByText('Save & add another'));
    expect(suit().value).toBe('spades');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('pin toggles survive Cancel', () => {
    mount({ spy: vi.fn() });
    fireEvent.click(screen.getByLabelText('Pin back artwork'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(loadPins('d1').back).toBeNull();
  });

  it('hints on a repeated name but still saves', () => {
    const spy = vi.fn();
    mount({ spy });
    fireEvent.click(screen.getByLabelText('Pin name'));
    fireEvent.change(name(), { target: { value: 'Goblin' } });
    fireEvent.click(screen.getByText('Save & add another'));
    expect(name().value).toBe('Goblin');
    expect(screen.getByText('Same name as the last card')).toBeTruthy();
    fireEvent.click(screen.getByText('Save & add another'));
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('a validation error keeps the form', () => {
    const spy = vi.fn();
    mount({ spy });
    fireEvent.change(copies(), { target: { value: '4' } });
    fireEvent.click(screen.getByText('Save & add another'));
    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Name is required');
    expect(copies().value).toBe('4');
  });
});

describe('ImagePicker library choice (2.3)', () => {
  it('Choose from images sets the card front without uploading', async () => {
    const lib = [{ id: 'f'.repeat(64), name: 'Goblin', addedAt: 1, uses: { cards: 0, deckBacks: 0, decks: 0 } }];
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(lib), { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const spy = vi.fn();
      mount({ spy });
      fireEvent.change(name(), { target: { value: 'G' } });
      fireEvent.click(screen.getAllByRole('button', { name: 'Choose from images…' })[0]);
      fireEvent.click(await screen.findByRole('button', { name: 'Use Goblin' }));
      expect(screen.queryByRole('dialog', { name: 'Choose from images' })).toBeNull();
      expect((screen.getByAltText('front') as HTMLImageElement).src).toContain('f'.repeat(64));
      fireEvent.click(screen.getByText('Done'));
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ frontImageId: 'f'.repeat(64) }));
      expect(fetchMock.mock.calls.every((c: any[]) => !String(c[0]).startsWith('/api/images'))).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
