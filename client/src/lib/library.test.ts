import { describe, expect, it, vi } from 'vitest';
import { cardsFromImages, deckImageIds, deckUsage, importFiles, usageText } from './library';

const file = (name: string, type = 'image/png', size = 100) => {
  const f = new File([new Uint8Array(1)], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

describe('importFiles (2.2)', () => {
  it('imports the good files, reports the bad ones, and shows progress', async () => {
    const progress: string[] = [];
    const upload = vi.fn(async (f: File) => {
      if (f.name === 'broken.png') throw new Error('Not a readable image');
      return { id: `id-${f.name}` };
    });
    const r = await importFiles(
      [file('a.png'), file('huge.png', 'image/png', 15 * 1024 * 1024), file('b.webp', 'image/webp'), file('doc.pdf', 'application/pdf'), file('broken.png')],
      (d, t) => progress.push(`${d}/${t}`),
      upload,
    );
    expect(r.ok.sort()).toEqual(['id-a.png', 'id-b.webp']);
    expect(r.failed).toEqual(
      expect.arrayContaining([
        { name: 'huge.png', error: 'Use PNG, JPEG or WebP images up to 10 MB' },
        { name: 'doc.pdf', error: 'Use PNG, JPEG or WebP images up to 10 MB' },
        { name: 'broken.png', error: 'Not a readable image' },
      ]),
    );
    expect(upload).toHaveBeenCalledTimes(3); // bad type/size never uploaded
    expect(progress[0]).toBe('0/5');
    expect(progress.at(-1)).toBe('5/5');
  });
});

describe('cardsFromImages (2.5)', () => {
  let n = 0;
  const newId = () => `c${++n}`;
  it('one card per image, in order, named after it with it as the front; copies 1 and template by default', () => {
    const cards = cardsFromImages(
      [
        { id: 'i2', name: 'Orc' },
        { id: 'i1', name: 'Goblin' },
      ],
      { props: [], abilities: [] },
      [{ key: 'suit', type: 'text' }, { key: 'face', type: 'boolean' }],
      newId,
    );
    expect(cards.map((c) => [c.name, c.frontImageId, c.count])).toEqual([
      ['Orc', 'i2', 1],
      ['Goblin', 'i1', 1],
    ]);
    expect(cards[0].metadata).toEqual({ face: false });
    expect(cards[0].backImageId).toBeUndefined();
    expect(new Set(cards.map((c) => c.id)).size).toBe(2);
  });

  it('applies pinned copies, back, description, properties and abilities; ignores a pinned name', () => {
    const [c] = cardsFromImages(
      [{ id: 'i1', name: 'Goblin' }],
      { name: 'Pinned ', count: '2', back: 'bk', description: 'Small', props: [{ key: 'tribe', type: 'text', value: 'goblin' }, { key: 'cost', type: 'number', value: 'x' }], abilities: [{ trigger: 'On Play', effect: 'Draw', target: 'Self' }] },
      [],
      newId,
    );
    expect(c).toMatchObject({ name: 'Goblin', count: 2, backImageId: 'bk', description: 'Small', metadata: { tribe: 'goblin' }, frontImageId: 'i1' });
    expect(c.abilities).toEqual([{ trigger: 'On Play', effect: 'Draw', target: 'Self' }]);
  });
});

describe('helpers', () => {
  it('deckImageIds collects fronts, backs and the deck back', () => {
    expect([...deckImageIds({ backImageId: 'b', cards: [{ id: '1', name: 'x', count: 1, metadata: {}, frontImageId: 'f', backImageId: 'g' }] })].sort()).toEqual(['b', 'f', 'g']);
  });
  it('deckUsage counts a card once even when front and back match', () => {
    const u = deckUsage({ backImageId: 'f', cards: [{ id: '1', name: 'x', count: 1, metadata: {}, frontImageId: 'f', backImageId: 'f' }, { id: '2', name: 'y', count: 1, metadata: {}, frontImageId: 'f' }] });
    expect(u.get('f')).toEqual({ cards: 2, deckBacks: 1, decks: 1 });
  });
  it('usageText', () => {
    expect(usageText({ cards: 0, deckBacks: 0, decks: 0 })).toBe('Unused');
    expect(usageText({ cards: 3, deckBacks: 1, decks: 2 })).toBe('3 cards · 1 deck back');
    expect(usageText({ cards: 1, deckBacks: 0, decks: 1 })).toBe('1 card');
  });
});
