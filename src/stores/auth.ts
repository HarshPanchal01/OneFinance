import { defineStore } from "pinia";
import { ref } from "vue";
import type { RememberPolicy } from "@/types";

type AuthResult = { success: boolean; error?: string };

// Thin wrapper over the master-password IPC (electron/main.ts auth:* handlers).
// The password itself never lives in the renderer state — it is passed straight
// to the main process, which holds it in memory for the unlocked session and
// (per the remember policy) may encrypt it into the OS keychain via safeStorage.
export const useAuthStore = defineStore("auth", () => {
  const hasMasterPassword = ref(false);
  const isUnlocked = ref(false);
  // The user's standing "stay unlocked for…" choice and whether the OS can store
  // it securely (false when there's no real keychain — see canRemember in Main).
  const rememberPolicy = ref<RememberPolicy>("session");
  const canRemember = ref(false);

  async function checkStatus() {
    const status = await window.electronAPI.getAuthStatus();
    hasMasterPassword.value = status.hasMasterPassword;
    isUnlocked.value = status.isUnlocked;
    rememberPolicy.value = status.rememberPolicy;
    canRemember.value = status.canRemember;
    return status;
  }

  // Launch-time no-prompt unlock using a still-valid remembered key. Falls back to
  // the manual screen (success: false) for any reason — see auth:tryAutoUnlock.
  async function tryAutoUnlock(): Promise<{ success: boolean }> {
    const result = await window.electronAPI.tryAutoUnlock();
    if (result.success) {
      isUnlocked.value = true;
    }
    return result;
  }

  async function create(password: string, policy: RememberPolicy): Promise<AuthResult> {
    const result = await window.electronAPI.createMasterPassword(password, policy);
    if (result.success) {
      hasMasterPassword.value = true;
      isUnlocked.value = true;
      rememberPolicy.value = policy;
    }
    return result;
  }

  async function unlock(password: string, policy: RememberPolicy): Promise<AuthResult> {
    const result = await window.electronAPI.unlock(password, policy);
    if (result.success) {
      isUnlocked.value = true;
      rememberPolicy.value = policy;
    }
    return result;
  }

  // Change the remember policy from Settings — Main reuses the in-memory session
  // password, so the user doesn't have to re-type it to re-arm a new window.
  async function setRememberPolicy(policy: RememberPolicy): Promise<AuthResult> {
    const result = await window.electronAPI.setRememberPolicy(policy);
    if (result.success) {
      rememberPolicy.value = policy;
    }
    return result;
  }

  function changePassword(oldPassword: string, newPassword: string): Promise<AuthResult> {
    return window.electronAPI.changeMasterPassword(oldPassword, newPassword);
  }

  // Re-lock the session: clears the in-memory passphrase in Main and re-locks the
  // database. The gate reappears; re-unlocking uses the normal unlock flow (and
  // deliberately skips the remembered-key auto-unlock so a lock isn't undone).
  async function lock(): Promise<void> {
    await window.electronAPI.lock();
    isUnlocked.value = false;
  }

  // Reflect a lock initiated by the main process (e.g. OS sleep / screen lock),
  // where the database has already been closed — just sync the renderer state.
  function markLocked(): void {
    isUnlocked.value = false;
  }

  return {
    hasMasterPassword,
    isUnlocked,
    rememberPolicy,
    canRemember,
    checkStatus,
    tryAutoUnlock,
    create,
    unlock,
    setRememberPolicy,
    changePassword,
    lock,
    markLocked,
  };
});
