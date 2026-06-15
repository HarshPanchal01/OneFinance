import type { RememberPolicy } from '@/types';

// Pure remember-window logic — deliberately free of any Electron imports so it can
// be unit-tested directly (see tests/rememberPolicy.test.ts). The safeStorage glue
// that actually persists the key lives in electron/main.ts.

// How long each policy keeps the app auto-unlockable. 'session' never persists.
export const POLICY_DURATION_MS: Record<RememberPolicy, number> = {
  session: 0,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '8h': 8 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
};

/** Absolute expiry timestamp (epoch ms) for a policy, or null for 'session'. */
export function computeExpiry(policy: RememberPolicy, now: number = Date.now()): number | null {
  if (policy === 'session') return null;
  return now + POLICY_DURATION_MS[policy];
}

/** True only while a stored remember-window is still open (and not 'session'/expired). */
export function isRememberValid(expiry: number | null, now: number = Date.now()): boolean {
  if (expiry === null) return false;
  return now < expiry;
}
