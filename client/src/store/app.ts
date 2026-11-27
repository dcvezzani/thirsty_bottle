import { create } from 'zustand';
import type { ChatMessage, PlayerPublic, ServerMessage, TableSummary } from '@vct/shared';
import { Socket, type ConnStatus } from '../net/socket';
import { getTabToken, holdToken, saveIdentity, setTabToken } from '../lib/identity';
import { isGuestToken } from '../lib/guests';
import { setImageKey } from '../lib/api';
import { useTable } from './table';

interface Toast {
  id: number;
  text: string;
  kind?: 'info' | 'error' | 'turn';
}

interface AppState {
  status: ConnStatus;
  me: PlayerPublic | null;
  myTableId: string | null;
  /** Whether I host my table, as of connecting (the live table view is more current when loaded). */
  myTableHost: boolean;
  players: PlayerPublic[];
  tables: TableSummary[];
  chat: Record<string, ChatMessage[]>;
  unread: Record<string, number>;
  /** Channels currently on screen (no unread counting). */
  viewing: Record<string, boolean>;
  muted: string[];
  toasts: Toast[];
  toast(text: string, kind?: Toast['kind']): void;
  setViewing(channel: string, on: boolean): void;
}

export const useApp = create<AppState>((set, get) => ({
  status: 'offline',
  me: null,
  myTableId: null,
  myTableHost: false,
  players: [],
  tables: [],
  chat: {},
  unread: {},
  viewing: {},
  muted: [],
  toasts: [],
  toast(text, kind = 'info') {
    const id = Date.now() + Math.random();
    set({ toasts: [...get().toasts.slice(-3), { id, text, kind }] });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), kind === 'error' ? 4500 : 3000);
  },
  setViewing(channel, on) {
    const viewing = { ...get().viewing, [channel]: on };
    const unread = on ? { ...get().unread, [channel]: 0 } : get().unread;
    set({ viewing, unread });
  },
}));

let socket: Socket | null = null;
export const getSocket = () => socket;

function onMessage(m: ServerMessage) {
  const st = useApp.getState();
  switch (m.t) {
    case 'welcome':
      useApp.setState({ me: m.player });
      break;
    case 'lobby': {
      const me = st.me ? m.players.find((p) => p.id === st.me!.id) ?? st.me : null;
      useApp.setState({ players: m.players, tables: m.tables, me });
      break;
    }
    case 'chat.history':
      useApp.setState({ chat: { ...st.chat, [m.channel]: m.messages } });
      break;
    case 'chat.msg': {
      const ch = m.message.channel;
      const list = (st.chat[ch] ?? []).concat(m.message).slice(-300);
      const mine = m.message.playerId === st.me?.id;
      const unread = st.viewing[ch] || mine ? st.unread : { ...st.unread, [ch]: (st.unread[ch] ?? 0) + 1 };
      useApp.setState({ chat: { ...st.chat, [ch]: list }, unread });
      break;
    }
    case 'chat.muted':
      useApp.setState({ muted: m.muted });
      break;
    case 'notice':
      st.toast(m.text);
      break;
    case 'error':
      st.toast(m.error, 'error');
      break;
  }
  useTable.getState().onMessage(m);
}

export function connect(token: string) {
  socket?.stop();
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  socket = new Socket({
    url: `${proto}://${location.host}/ws`,
    token,
    onStatus: (status) => useApp.setState({ status }),
    onHello: (data) => {
      setImageKey(data.imageKey);
      useApp.setState({ me: data.player, myTableId: data.tableId, myTableHost: !!data.tableHost });
      if (!isGuestToken(token)) saveIdentity({ token, id: data.player.id, name: data.player.name, color: data.player.color }); // guests are not offered in the picker
      useTable.getState().onReconnected();
    },
  });
  socket.on(onMessage);
  socket.start();
  holdToken(() => getTabToken());
  return socket;
}

export function disconnect() {
  socket?.stop();
  socket = null;
}

export function switchIdentity(token: string | null) {
  disconnect();
  setTabToken(token);
  useApp.setState({ me: null, status: 'offline', chat: {}, unread: {}, players: [], tables: [] });
  useTable.getState().reset();
}

/** pass-and-play: connect as another person on this phone (the previous person's view leaves memory with the old connection). */
export function switchPerson(p: { token: string }) {
  switchIdentity(p.token);
  connect(p.token);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => socket?.reconnectNow());
}
