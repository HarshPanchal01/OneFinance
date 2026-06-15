import { defineStore } from "pinia";
import { ref } from "vue";

type AuthResult = { success: boolean; error?: string };

// Thin wrapper over the master-password IPC (electron/main.ts auth:* handlers).
// The password itself never lives in the renderer state — it is passed straight
// to the main process, which holds it in memory for the unlocked session.
export const useAuthStore = defineStore("auth", () => {
  const hasMasterPassword = ref(false);
  const isUnlocked = ref(false);

  async function checkStatus() {
    const status = await window.electronAPI.getAuthStatus();
    hasMasterPassword.value = status.hasMasterPassword;
    isUnlocked.value = status.isUnlocked;
    return status;
  }

  async function create(password: string): Promise<AuthResult> {
    const result = await window.electronAPI.createMasterPassword(password);
    if (result.success) {
      hasMasterPassword.value = true;
      isUnlocked.value = true;
    }
    return result;
  }

  async function unlock(password: string): Promise<AuthResult> {
    const result = await window.electronAPI.unlock(password);
    if (result.success) {
      isUnlocked.value = true;
    }
    return result;
  }

  function changePassword(oldPassword: string, newPassword: string): Promise<AuthResult> {
    return window.electronAPI.changeMasterPassword(oldPassword, newPassword);
  }

  return { hasMasterPassword, isUnlocked, checkStatus, create, unlock, changePassword };
});
