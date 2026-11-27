/**
 * pass-and-play: the people on this phone for each table. The host's own token is kept as the way back,
 * and each guest's token lets the phone connect as that guest. Stored per browser; never in the identity picker.
 */
export interface Person {
  token: string;
  id: string;
  name: string;
  color: string;
}
export interface PhoneTable {
  host: Person;
  guests: (Person & { seatId?: string })[];
}

const KEY = 'vct.phone';

function read(): Record<string, PhoneTable> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}
function write(all: Record<string, PhoneTable>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable */
  }
}

export function phoneTable(tableId: string): PhoneTable | null {
  return read()[tableId] ?? null;
}

export function addPhoneGuest(tableId: string, host: Person, guest: Person & { seatId?: string }) {
  const all = read();
  const cur = all[tableId] ?? { host, guests: [] };
  cur.host = host;
  cur.guests = cur.guests.filter((g) => g.id !== guest.id).concat(guest);
  all[tableId] = cur;
  write(all);
}

export function removePhoneGuest(tableId: string, guestId: string) {
  const all = read();
  const cur = all[tableId];
  if (!cur) return;
  cur.guests = cur.guests.filter((g) => g.id !== guestId);
  if (!cur.guests.length) delete all[tableId];
  write(all);
}

export function forgetPhoneTable(tableId: string) {
  const all = read();
  delete all[tableId];
  write(all);
}

/** Whether a token is a guest's (guests are never offered in the "continue as" picker). */
export function isGuestToken(token: string): boolean {
  return Object.values(read()).some((t) => t.guests.some((g) => g.token === token));
}

/** Everyone who can be connected on this phone for the table: the host first, then the guests that still have a token here. */
export function phonePeople(tableId: string): Person[] {
  const t = phoneTable(tableId);
  return t && t.guests.length ? [t.host, ...t.guests] : [];
}
