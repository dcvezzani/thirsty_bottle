import { describe, expect, it, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { TableDeckView } from '@vct/shared';
import { CardFace } from './Card';

afterEach(cleanup);

const decks: TableDeckView[] = [
  {
    id: 'd1',
    sourceDeckId: null,
    versionId: null,
    name: 'Monsters',
    homeZoneId: 'z1',
    defs: [
      { id: 'gob', name: 'Goblin', count: 3, metadata: { power: 1 } },
      { id: 'orc', name: 'Orc', count: 1, metadata: {} },
    ],
  },
];

describe('card renderer (9.1)', () => {
  it('shows a copy-number badge on visible faces of duplicated definitions', () => {
    const { getByTestId, getByRole } = render(<CardFace card={{ h: 'a', faceUp: true, known: true, deck: 'd1', def: 'gob', copyNo: 2, copyOf: 3 }} decks={decks} />);
    expect(getByTestId('copy-badge').textContent).toBe('2/3');
    expect(getByRole('img').getAttribute('aria-label')).toBe('Goblin #2');
  });
  it('no badge for single copies', () => {
    const { queryByTestId, getByRole } = render(<CardFace card={{ h: 'b', faceUp: true, known: true, deck: 'd1', def: 'orc', copyNo: 1, copyOf: 1 }} decks={decks} />);
    expect(queryByTestId('copy-badge')).toBeNull();
    expect(getByRole('img').getAttribute('aria-label')).toBe('Orc');
  });
  it('hidden cards render only a back: no badge, no name', () => {
    const { queryByTestId, getByRole, container } = render(<CardFace card={{ h: 'c', faceUp: false, known: false }} decks={decks} />);
    expect(queryByTestId('copy-badge')).toBeNull();
    expect(getByRole('img').getAttribute('aria-label')).toBe('Face-down card');
    expect(container.textContent).not.toContain('Goblin');
    expect(container.querySelector('.gen-back')).not.toBeNull();
  });
  it('generates a text face with name and metadata when there is no artwork', () => {
    const { container } = render(<CardFace card={{ h: 'd', faceUp: true, known: true, deck: 'd1', def: 'gob', copyNo: 1, copyOf: 3 }} decks={decks} />);
    expect(container.querySelector('.text-face')?.textContent).toContain('Goblin');
    expect(container.querySelector('.text-face')?.textContent).toContain('power: 1');
  });
});
