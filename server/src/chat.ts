import { CHAT_HISTORY, CHAT_MAX_CHARS, type ChatMessage } from '@vct/shared';
import type { App } from './app.js';

const LOBBY_RETENTION_MS = 7 * 24 * 3600_000; // spec: at least 24 h
const THROTTLE_COUNT = 5;
const THROTTLE_WINDOW_MS = 5000;

export class ChatError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export class Chat {
  private recent = new Map<string, number[]>();
  constructor(private app: App) {}

  /** Who may read/post in a channel. */
  private members(channel: string): string[] | 'all' | null {
    if (channel === 'lobby') return 'all';
    if (channel.startsWith('table:')) {
      const s = this.app.tables.get(channel.slice(6));
      return s ? s.participants() : null;
    }
    return null;
  }

  canAccess(channel: string, pid: string): boolean {
    const m = this.members(channel);
    return m === 'all' || (!!m && m.includes(pid));
  }

  post(channel: string, pid: string, rawText: string): ChatMessage {
    const player = this.app.players.get(pid);
    if (!player) throw new ChatError('NO_PLAYER', 'Unknown player');
    if (!this.canAccess(channel, pid)) throw new ChatError('NO_ACCESS', 'You are not in that channel');
    const text = rawText.replace(/\r\n?/g, '\n').trim();
    if (!text) throw new ChatError('EMPTY', 'Message is empty');
    if ([...text].length > CHAT_MAX_CHARS) throw new ChatError('TOO_LONG', `Messages are limited to ${CHAT_MAX_CHARS} characters`);
    if (channel.startsWith('table:')) {
      const s = this.app.tables.get(channel.slice(6));
      if (s?.roomMuted.has(pid)) throw new ChatError('ROOM_MUTED', 'The host has muted you in this room');
    }
    const key = `${pid}|${channel}`;
    const now = Date.now();
    const times = (this.recent.get(key) ?? []).filter((t) => now - t < THROTTLE_WINDOW_MS);
    if (times.length >= THROTTLE_COUNT) throw new ChatError('SLOW_DOWN', 'Slow down: too many messages');
    times.push(now);
    this.recent.set(key, times);
    const info = this.app.db
      .prepare('INSERT INTO chat_messages (channel, at, player_id, name, color, text) VALUES (?, ?, ?, ?, ?, ?)')
      .run(channel, now, pid, player.name, player.color, text);
    const msg: ChatMessage = {
      id: Number(info.lastInsertRowid),
      channel,
      at: now,
      playerId: pid,
      name: player.name,
      color: player.color,
      text,
    };
    this.deliver(msg);
    return msg;
  }

  private deliver(msg: ChatMessage) {
    const m = this.members(msg.channel);
    const targets = m === 'all' ? this.app.hub.connectedIds() : (m ?? []);
    for (const pid of targets) {
      const p = this.app.players.get(pid);
      if (msg.playerId && p?.muted.includes(msg.playerId)) continue;
      this.app.hub.send(pid, { t: 'chat.msg', message: msg });
    }
  }

  history(channel: string, forPid: string): ChatMessage[] {
    const muted = new Set(this.app.players.get(forPid)?.muted ?? []);
    const rows = this.app.db
      .prepare('SELECT * FROM chat_messages WHERE channel = ? ORDER BY id DESC LIMIT ?')
      .all(channel, CHAT_HISTORY + muted.size * 20) as any[];
    return rows
      .filter((r) => !r.player_id || !muted.has(r.player_id))
      .slice(0, CHAT_HISTORY)
      .reverse()
      .map((r) => ({ id: r.id, channel: r.channel, at: r.at, playerId: r.player_id, name: r.name, color: r.color, text: r.text }));
  }

  sendHistory(channel: string, pid: string) {
    this.app.hub.send(pid, { t: 'chat.history', channel, messages: this.history(channel, pid) });
  }

  deleteChannel(channel: string) {
    this.app.db.prepare('DELETE FROM chat_messages WHERE channel = ?').run(channel);
  }

  purge() {
    this.app.db.prepare("DELETE FROM chat_messages WHERE channel = 'lobby' AND at < ?").run(Date.now() - LOBBY_RETENTION_MS);
  }
}
