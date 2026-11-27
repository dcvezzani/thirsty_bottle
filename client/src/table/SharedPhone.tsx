import { useEffect, useRef } from 'react';
import type { TableView } from '@vct/shared';
import { phonePeople } from '../lib/guests';
import { switchPerson, useApp } from '../store/app';
import { decide, useShared, type Cover } from './sharedPhone';

const same = (a: Cover | null, b: Cover | null) => JSON.stringify(a) === JSON.stringify(b);

/** pass-and-play: raises and clears the covers as the turn moves, and connects as the next person on this phone. */
export function useSharedPhone(view: TableView | null) {
  const prev = useRef<string | null | undefined>(undefined);
  const switching = useRef<string | null>(null);
  useEffect(() => {
    if (!view) return;
    const first = prev.current === undefined;
    const was = first ? view.turn.active : prev.current!;
    prev.current = view.turn.active;
    if (switching.current && switching.current === view.me.playerId) switching.current = null;
    const cur = useShared.getState().cover;
    const d = decide(view, phonePeople(view.id), cur, was);
    if (!same(d.cover, cur)) useShared.getState().setCover(d.cover);
    if (d.switchTo && d.switchTo.id !== view.me.playerId && switching.current !== d.switchTo.id) {
      switching.current = d.switchTo.id;
      switchPerson(d.switchTo);
    }
  }, [view]);
  // the covers belong to one table
  useEffect(() => () => useShared.getState().setCover(null), []);
}

/** The covers: nothing of the table is rendered under them. */
export function SharedCover({ tableId }: { tableId: string }) {
  const cover = useShared((s) => s.cover);
  const meId = useApp((s) => s.me?.id);
  if (!cover) return null;
  const people = phonePeople(tableId);
  const setCover = useShared.getState().setCover;
  const choose = (id: string) => {
    const p = people.find((x) => x.id === id);
    if (!p) return setCover(null);
    if (p.id === meId) return setCover(null);
    setCover({ kind: 'pass', personId: p.id });
    switchPerson(p);
  };
  return (
    <div className="handoff-cover" role="dialog" aria-label="Pass the phone" data-testid="handoff-cover">
      {cover.kind === 'pass' && (() => {
        const p = people.find((x) => x.id === cover.personId);
        const name = p?.name ?? 'the next player';
        return (
          <>
            <p className="handoff-lead">Pass the phone to</p>
            <h1 className="handoff-name">{name}</h1>
            <button className="primary big" onClick={() => (p && p.id !== meId ? choose(p.id) : setCover(null))} disabled={!!p && p.id !== meId}>
              I'm {name}: show my cards
            </button>
          </>
        );
      })()}
      {cover.kind === 'wait' && (
        <>
          <p className="handoff-lead">Waiting for</p>
          <h1 className="handoff-name">{cover.name}</h1>
          <p className="muted">It's their turn on their own device.</p>
          {people.length > 1 && (
            <button className="big" onClick={() => setCover({ kind: 'pick' })}>
              Who's playing?
            </button>
          )}
        </>
      )}
      {cover.kind === 'pick' && (
        <>
          <h1 className="handoff-name">Who's playing?</h1>
          <div className="handoff-people">
            {people.map((p) => (
              <button key={p.id} className="big" onClick={() => choose(p.id)}>
                {p.name}
              </button>
            ))}
          </div>
          <button onClick={() => setCover(null)}>Cancel</button>
        </>
      )}
    </div>
  );
}
