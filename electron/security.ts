import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { RememberPolicy } from '@/types';

// Encryption metadata that must live OUTSIDE the encrypted database — it's needed
// to verify the master password before the database can be opened, so it can't be
// stored inside it. Mirrors the app-preferences.json / backup-settings.json
// sidecar pattern (Main-owned JSON in userData).
export interface SecurityConfig {
  // A known value encrypted with the master password (electron/crypto.ts
  // createVerifier). Lets us check a password without opening the database.
  // Null until the user creates a master password.
  verifier: string | null;
  // How long the app may auto-unlock without re-entering the master password.
  // 'session' (default) never persists the key — the password is required every launch.
  rememberPolicy: RememberPolicy;
  // The master password encrypted with Electron safeStorage (OS keychain),
  // base64-encoded. Null unless a non-session policy is active. NEVER plaintext.
  rememberedKey: string | null;
  // Epoch-ms timestamp after which rememberedKey must not be used (absolute window).
  rememberExpiry: number | null;
}

const DEFAULTS: SecurityConfig = {
  verifier: null,
  rememberPolicy: 'session',
  rememberedKey: null,
  rememberExpiry: null,
};

function getSecurityPath(): string {
  return path.join(app.getPath('userData'), 'security.json');
}

export function loadSecurity(): SecurityConfig {
  try {
    const raw = fs.readFileSync(getSecurityPath(), 'utf-8');
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSecurity(partial: Partial<SecurityConfig>): SecurityConfig {
  const merged = { ...loadSecurity(), ...partial };
  try {
    fs.writeFileSync(getSecurityPath(), JSON.stringify(merged, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Security] Failed to save security config:', err);
  }
  return merged;
}

export function clearSecurity(): void {
  try {
    fs.rmSync(getSecurityPath(), { force: true });
  } catch (err) {
    console.error('[Security] Failed to clear security config:', err);
  }
}

export function hasMasterPassword(): boolean {
  return loadSecurity().verifier !== null;
}
