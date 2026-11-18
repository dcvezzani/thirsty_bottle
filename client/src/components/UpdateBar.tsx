import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isIdleLobby, useUpdate } from '../update';

/** "A new version is available" notice with Reload (app-shell: update notice). */
export function UpdateBar() {
  const waiting = useUpdate((s) => s.waiting);
  const apply = useUpdate((s) => s.apply);
  if (!waiting) return null;
  return (
    <div className="banner update-bar" role="status" aria-live="polite">
      <span>A new version is available</span>
      <button className="primary" onClick={apply}>
        Reload
      </button>
    </div>
  );
}

/** Applies a waiting update automatically while the lobby is idle (app-shell: idle lobby). */
export function UpdateGate() {
  const waiting = useUpdate((s) => s.waiting);
  const { pathname } = useLocation();
  useEffect(() => {
    if (!waiting || pathname !== '/') return;
    const tryApply = () => {
      if (isIdleLobby(document, location.pathname)) useUpdate.getState().apply();
    };
    // let the lobby render (and any dialog it restores) before deciding
    const first = setTimeout(tryApply, 300);
    const timer = setInterval(tryApply, 2000);
    const later = () => setTimeout(tryApply, 50);
    document.addEventListener('focusout', later);
    document.addEventListener('pointerup', later);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener('focusout', later);
      document.removeEventListener('pointerup', later);
    };
  }, [waiting, pathname]);
  return null;
}
