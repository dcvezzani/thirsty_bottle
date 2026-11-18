import { create } from 'zustand';
import { registerSW } from 'virtual:pwa-register';

/**
 * App updates (app-shell): a new version waits until the player taps Reload or the lobby is idle.
 * This is the only module allowed to activate a waiting service worker.
 */
interface UpdateState {
  waiting: boolean;
  apply(): void;
}

let updateSW: ((reload?: boolean) => Promise<void>) | null = null;
let applying = false;

export const useUpdate = create<UpdateState>(() => ({
  waiting: false,
  apply() {
    if (applying || !updateSW) return;
    applying = true;
    void updateSW(true);
  },
}));

export const CHECK_EVERY_MS = 30 * 60_000;
const FOREGROUND_THROTTLE_MS = 60_000;

/** Ask the browser to look for a new service worker: every 30 min, and on return to the foreground. */
export function scheduleChecks(reg: { update(): Promise<unknown> }, win: Window = window): () => void {
  let last = Date.now();
  const check = () => {
    last = Date.now();
    reg.update().catch(() => {
      /* offline: try again later */
    });
  };
  const timer = win.setInterval(check, CHECK_EVERY_MS);
  const onVis = () => {
    if (win.document.visibilityState === 'visible' && Date.now() - last >= FOREGROUND_THROTTLE_MS) check();
  };
  win.document.addEventListener('visibilitychange', onVis);
  return () => {
    win.clearInterval(timer);
    win.document.removeEventListener('visibilitychange', onVis);
  };
}

export function initUpdates() {
  // lets e2e checks (contrast) show the notice without a real deploy; it can only show the notice
  (window as unknown as { __vctShowUpdate?: () => void }).__vctShowUpdate = () => useUpdate.setState({ waiting: true });
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      useUpdate.setState({ waiting: true });
    },
    onRegisteredSW(_url, reg) {
      if (reg) scheduleChecks(reg);
    },
  });
}

/** Test hook. */
export function _resetUpdates(fn: typeof updateSW = null) {
  updateSW = fn;
  applying = false;
  useUpdate.setState({ waiting: false });
}

/** The lobby with nothing in progress: no dialog open and no field focused. */
export function isIdleLobby(doc: Document = document, path: string = location.pathname): boolean {
  if (path !== '/') return false;
  if (doc.querySelector('[role="dialog"], [role="alertdialog"]')) return false;
  const a = doc.activeElement as HTMLElement | null;
  if (a && (a.matches('input, textarea, select') || a.isContentEditable)) return false;
  return true;
}
