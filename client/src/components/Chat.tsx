import { useEffect, useMemo, useRef, useState } from 'react';
import { CHAT_MAX_CHARS, type ChatMessage, type LogView } from '@vct/shared';
import { getSocket, useApp } from '../store/app';

interface Props {
  channel: string;
  /** Table log entries to show inline as system messages (room chat). */
  log?: LogView[];
  title?: string;
}

type Item = { key: string; at: number; msg?: ChatMessage; log?: LogView };

/** Shared chat panel (lobby and room). Messages render as plain text: never HTML. */
export function Chat({ channel, log, title }: Props) {
  const messages = useApp((s) => s.chat[channel]) ?? [];
  const muted = useApp((s) => s.muted);
  const me = useApp((s) => s.me);
  const setViewing = useApp((s) => s.setViewing);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [showCardActions, setShowCardActions] = useState(() => localStorage.getItem('vct.cardActions') !== 'off');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setViewing(channel, true);
    return () => setViewing(channel, false);
  }, [channel, setViewing]);

  const items: Item[] = useMemo(() => {
    const a: Item[] = messages.filter((m) => !m.playerId || !muted.includes(m.playerId)).map((m) => ({ key: `m${m.id}`, at: m.at, msg: m }));
    if (log) for (const e of log) if (showCardActions || !e.cardAction) a.push({ key: `l${e.id}`, at: e.at, log: e });
    return a.sort((x, y) => x.at - y.at).slice(-250);
  }, [messages, muted, log, showCardActions]);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setErr('');
    try {
      await getSocket()?.request({ t: 'chat.send', channel, text: t });
      setText('');
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const toggleMute = (pid: string) => getSocket()?.request({ t: 'chat.mute', playerId: pid, muted: !muted.includes(pid) });

  return (
    <div className="chat" data-channel={channel}>
      {(title || log) && (
        <div className="row" style={{ padding: '4px 8px', borderBottom: '1px solid var(--line)' }}>
          {title && <strong className="grow small-text">{title}</strong>}
          {log && (
            <label className="row small-text" style={{ margin: 0 }}>
              <input
                type="checkbox"
                style={{ width: 18, minHeight: 18 }}
                checked={showCardActions}
                onChange={(e) => {
                  setShowCardActions(e.target.checked);
                  localStorage.setItem('vct.cardActions', e.target.checked ? 'on' : 'off');
                }}
              />
              Card actions
            </label>
          )}
        </div>
      )}
      <div className="chat-log" ref={ref} role="log" aria-label={`${channel === 'lobby' ? 'Lobby' : 'Room'} messages`}>
        {items.length === 0 && <div className="empty">No messages yet. Say hi!</div>}
        {items.map((it) =>
          it.msg ? (
            <div key={it.key} className="chat-msg" data-testid="chat-msg">
              <span className="who" style={{ color: it.msg.color }}>
                {it.msg.name}
              </span>
              {it.msg.text}
              {it.msg.playerId && it.msg.playerId !== me?.id && (
                <button className="ghost small" style={{ minHeight: 24, padding: '0 4px', marginLeft: 4, opacity: 0.6 }} aria-label={`Mute ${it.msg.name}`} onClick={() => toggleMute(it.msg!.playerId!)}>
                  🔇
                </button>
              )}
            </div>
          ) : (
            <div key={it.key} className="chat-msg system" data-testid="chat-system">
              {it.log!.text}
            </div>
          ),
        )}
      </div>
      {muted.length > 0 && (
        <div className="small-text muted" style={{ padding: '0 8px' }}>
          {muted.length} muted ·{' '}
          <button className="ghost small" onClick={() => muted.forEach((p) => getSocket()?.request({ t: 'chat.mute', playerId: p, muted: false }))}>
            Unmute all
          </button>
        </div>
      )}
      <form className="chat-form" onSubmit={send}>
        <input
          aria-label={channel === 'lobby' ? 'Message the lobby' : 'Message the room'}
          placeholder={channel === 'lobby' ? 'Message the lobby…' : 'Message the room…'}
          value={text}
          maxLength={CHAT_MAX_CHARS}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="primary">Send</button>
      </form>
      {err && <div className="err" style={{ padding: '0 8px 8px' }}>{err}</div>}
    </div>
  );
}
