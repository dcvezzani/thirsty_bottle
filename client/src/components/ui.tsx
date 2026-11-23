import { useEffect, useRef, type ReactNode } from 'react';
import { useApp } from '../store/app';

export function Sheet({ title, onClose, children, label }: { title: string; onClose: () => void; children: ReactNode; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Escape closes only the topmost sheet (sheets can open over sheets, e.g. the image picker over the card form).
    const k = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const sheets = document.querySelectorAll('.sheet');
      if (sheets[sheets.length - 1] === ref.current) onClose();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="overlay" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" ref={ref} role="dialog" aria-label={label ?? title}>
        <div className="row">
          <h2 className="grow">{title}</h2>
          <button className="ghost" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; badge?: number }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}>
          {t.label}
          {t.badge ? (
            <span className="badge" aria-label={`${t.badge} unread`}>
              {t.badge}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind ?? ''}`} role={t.kind === 'error' ? 'alert' : 'status'}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function ConnectionBanner() {
  const status = useApp((s) => s.status);
  if (status === 'online') return null;
  if (status === 'replaced') return null;
  return (
    <div className={`banner ${status === 'offline' ? 'offline' : ''}`} role="status">
      {status === 'connecting' ? 'Connecting…' : 'Connection lost: reconnecting…'}
    </div>
  );
}

export const PLAYER_COLORS = ['#c8102e', '#1f6fd1', '#1f7a4d', '#b8860b', '#7b3fa0', '#d2691e', '#0e8a8a', '#c2185b', '#455a64', '#6d4c41'];
