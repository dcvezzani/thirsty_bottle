/**
 * Per-window identity (design D8):
 * - the active player token lives in sessionStorage (scoped to one tab, survives reloads)
 * - localStorage keeps the list of identities used in this browser for the "continue as…" picker
 * - a BroadcastChannel detects duplicated tabs that copied another live tab's sessionStorage
 */
export interface Identity {
  token: string;
  id: string;
  name: string;
  color: string;
  lastUsed: number;
}

const SESSION_KEY = 'vct.token';
const LIST_KEY = 'vct.identities';

function safe<T>(f: () => T, fallback: T): T {
  try {
    return f();
  } catch {
    return fallback;
  }
}

export function listIdentities(): Identity[] {
  return safe(() => JSON.parse(localStorage.getItem(LIST_KEY) ?? '[]') as Identity[], []).sort((a, b) => b.lastUsed - a.lastUsed);
}

export function saveIdentity(i: Omit<Identity, 'lastUsed'>) {
  const list = listIdentities().filter((x) => x.token !== i.token);
  list.unshift({ ...i, lastUsed: Date.now() });
  safe(() => localStorage.setItem(LIST_KEY, JSON.stringify(list.slice(0, 20))), undefined);
}

export function forgetIdentity(token: string) {
  safe(() => localStorage.setItem(LIST_KEY, JSON.stringify(listIdentities().filter((x) => x.token !== token))), undefined);
}

export function getTabToken(): string | null {
  return safe(() => sessionStorage.getItem(SESSION_KEY), null);
}

export function setTabToken(token: string | null) {
  safe(() => (token ? sessionStorage.setItem(SESSION_KEY, token) : sessionStorage.removeItem(SESSION_KEY)), undefined);
}

/** Tab instance id (not persisted): distinguishes this tab from a duplicate holding the same token. */
export const TAB_ID = Math.random().toString(36).slice(2);

type Msg = { type: 'claim' | 'held'; token: string; tab: string };

/**
 * Announces this tab's token. Resolves true if another live tab already holds it
 * (a duplicated tab), in which case the caller shows the identity picker instead.
 */
export function checkDuplicateTab(token: string, waitMs = 250): Promise<boolean> {
  if (typeof BroadcastChannel === 'undefined') return Promise.resolve(false);
  return new Promise((resolve) => {
    const ch = new BroadcastChannel('vct-identity');
    let dup = false;
    ch.onmessage = (e: MessageEvent<Msg>) => {
      if (e.data.type === 'held' && e.data.token === token && e.data.tab !== TAB_ID) dup = true;
    };
    ch.postMessage({ type: 'claim', token, tab: TAB_ID } satisfies Msg);
    setTimeout(() => {
      ch.close();
      resolve(dup);
    }, waitMs);
  });
}

let holder: BroadcastChannel | null = null;
/** Answers other tabs' claims for the token this tab holds. */
export function holdToken(getToken: () => string | null) {
  if (typeof BroadcastChannel === 'undefined' || holder) return;
  holder = new BroadcastChannel('vct-identity');
  holder.onmessage = (e: MessageEvent<Msg>) => {
    if (e.data.type === 'claim' && e.data.tab !== TAB_ID && e.data.token === getToken())
      holder!.postMessage({ type: 'held', token: e.data.token, tab: TAB_ID } satisfies Msg);
  };
}
