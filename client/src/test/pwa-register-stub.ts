// Test stand-in for vite-plugin-pwa's virtual module (aliased in vitest.config.ts).
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';

export const calls: RegisterSWOptions[] = [];
export const updateSW = { calls: [] as (boolean | undefined)[] };

export function registerSW(opts: RegisterSWOptions = {}) {
  calls.push(opts);
  return async (reload?: boolean) => {
    updateSW.calls.push(reload);
  };
}
