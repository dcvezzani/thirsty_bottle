import { afterEach, describe, expect, it, vi } from 'vitest';
import { calls, updateSW } from './test/pwa-register-stub';
import { CHECK_EVERY_MS, _resetUpdates, initUpdates, isIdleLobby, scheduleChecks, useUpdate } from './update';

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
  _resetUpdates();
});

describe('app updates (app-update-prompt 1.1)', () => {
  it('a waiting worker sets `waiting`; apply() activates it once and reloads', () => {
    initUpdates();
    const opts = calls[calls.length - 1];
    expect(opts.immediate).toBe(true);
    expect(useUpdate.getState().waiting).toBe(false);
    opts.onNeedRefresh!();
    expect(useUpdate.getState().waiting).toBe(true);
    const before = updateSW.calls.length;
    useUpdate.getState().apply();
    useUpdate.getState().apply();
    expect(updateSW.calls.slice(before)).toEqual([true]);
  });

  it('checks every 30 minutes and on return to the foreground (throttled to once a minute)', () => {
    vi.useFakeTimers();
    const reg = { update: vi.fn(() => Promise.resolve()) };
    const stop = scheduleChecks(reg);
    vi.advanceTimersByTime(CHECK_EVERY_MS - 1);
    expect(reg.update).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(1);
    expect(reg.update).toHaveBeenCalledTimes(1);
    const vis = (state: string) => {
      Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    vis('visible'); // right after a check: throttled
    expect(reg.update).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(61_000);
    vis('hidden');
    expect(reg.update).toHaveBeenCalledTimes(1);
    vis('visible');
    expect(reg.update).toHaveBeenCalledTimes(2);
    stop();
    vi.advanceTimersByTime(CHECK_EVERY_MS * 2);
    expect(reg.update).toHaveBeenCalledTimes(2);
  });
});

describe('isIdleLobby (app-update-prompt 2.2)', () => {
  it('only the lobby with no dialog and no focused field is idle', () => {
    expect(isIdleLobby(document, '/')).toBe(true);
    expect(isIdleLobby(document, '/t/abc')).toBe(false);
    expect(isIdleLobby(document, '/decks/d1')).toBe(false);
    expect(isIdleLobby(document, '/decks')).toBe(false);
    document.body.innerHTML = '<div role="dialog"><input id="f"></div>';
    expect(isIdleLobby(document, '/')).toBe(false);
    document.body.innerHTML = '<input id="f">';
    expect(isIdleLobby(document, '/')).toBe(true);
    (document.getElementById('f') as HTMLInputElement).focus();
    expect(isIdleLobby(document, '/')).toBe(false);
    document.body.innerHTML = '<div role="alertdialog"></div>';
    expect(isIdleLobby(document, '/')).toBe(false);
  });
});
