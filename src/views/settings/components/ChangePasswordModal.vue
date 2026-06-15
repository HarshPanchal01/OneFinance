<script setup lang="ts">
import { ref } from "vue";
import { useAuthStore } from "@/stores/auth";
import PasswordInput from "@/components/PasswordInput.vue";

const auth = useAuthStore();

const isOpen = ref(false);
const submitting = ref(false);
const oldPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const error = ref("");
const success = ref(false);
const reencrypting = ref(false);
const reencryptResult = ref<{ updated: number; failed: number } | null>(null);

const MIN_LENGTH = 8;

function reset() {
  oldPassword.value = "";
  newPassword.value = "";
  confirmPassword.value = "";
  error.value = "";
  success.value = false;
  submitting.value = false;
  reencrypting.value = false;
  reencryptResult.value = null;
}

function open() {
  reset();
  isOpen.value = true;
}

function close() {
  isOpen.value = false;
}

async function submit() {
  error.value = "";
  if (!oldPassword.value || !newPassword.value) {
    error.value = "Please fill in all fields.";
    return;
  }
  if (newPassword.value.length < MIN_LENGTH) {
    error.value = `New password must be at least ${MIN_LENGTH} characters.`;
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    error.value = "New passwords do not match.";
    return;
  }

  submitting.value = true;
  try {
    const result = await auth.changePassword(oldPassword.value, newPassword.value);
    if (result.success) {
      success.value = true;
    } else {
      error.value = result.error || "Could not change password.";
    }
  } finally {
    submitting.value = false;
  }
}

// After a successful change we still hold both passwords, so we can re-encrypt
// the user's chosen backup files from the old password to the new one.
async function reencryptBackups() {
  reencrypting.value = true;
  try {
    const result = await window.electronAPI.reencryptBackups(oldPassword.value, newPassword.value);
    if (!result.canceled) {
      reencryptResult.value = { updated: result.updated, failed: result.failed };
    }
  } finally {
    reencrypting.value = false;
  }
}

defineExpose({ open });
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
  >
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-[440px] max-w-full overflow-hidden relative">
      <button
        class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors z-10"
        @click="close"
      >
        <i class="pi pi-times text-sm" />
      </button>

      <div class="bg-primary-500/10 px-6 pt-8 pb-6 flex flex-col items-center text-center">
        <div class="w-14 h-14 rounded-full bg-primary-500/15 flex items-center justify-center mb-4">
          <i class="pi pi-key text-2xl text-primary-500" />
        </div>
        <h2 class="text-lg font-bold text-gray-900 dark:text-white mb-2">
          Change Master Password
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          Your database will be re-encrypted with the new password.
        </p>
      </div>

      <div
        v-if="success"
        class="px-6 py-6 space-y-4"
      >
        <div class="text-center space-y-2">
          <i class="pi pi-check-circle text-3xl text-green-500" />
          <p class="text-sm text-gray-600 dark:text-gray-300">
            Master password changed successfully.
          </p>
        </div>

        <div class="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-4 space-y-3">
          <div class="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
            <i class="pi pi-info-circle mt-0.5 flex-shrink-0" />
            <span>Backups encrypted with your old password won't open anymore. Select any you'd like to re-encrypt with your new password.</span>
          </div>

          <p
            v-if="reencryptResult"
            class="text-xs"
            :class="reencryptResult.failed ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'"
          >
            Updated {{ reencryptResult.updated }} backup{{ reencryptResult.updated === 1 ? '' : 's' }}<span v-if="reencryptResult.failed">; {{ reencryptResult.failed }} could not be read (wrong password or not a OneFinance file)</span>.
          </p>

          <button
            type="button"
            :disabled="reencrypting"
            class="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-60 transition-colors"
            @click="reencryptBackups"
          >
            <i
              :class="reencrypting ? 'pi pi-spin pi-spinner' : 'pi pi-folder-open'"
              class="mr-1.5"
            />
            {{ reencryptResult ? 'Update more backups' : 'Update old backups…' }}
          </button>
        </div>

        <div class="flex justify-center">
          <button
            class="inline-flex items-center px-4 py-2 bg-primary-500 dark:bg-primary-900/40 text-white dark:text-primary-300 hover:bg-primary-600 dark:hover:bg-primary-900/60 rounded-lg text-sm transition-colors"
            @click="close"
          >
            Done
          </button>
        </div>
      </div>

      <form
        v-else
        class="px-6 py-5 space-y-4"
        @submit.prevent="submit"
      >
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current password</label>
          <PasswordInput v-model="oldPassword" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New password</label>
          <PasswordInput v-model="newPassword" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm new password</label>
          <PasswordInput v-model="confirmPassword" />
        </div>

        <div class="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
          <i class="pi pi-exclamation-triangle mt-0.5 flex-shrink-0" />
          <span>If you forget the new password, your data cannot be recovered.</span>
        </div>

        <div class="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3">
          <i class="pi pi-info-circle mt-0.5 flex-shrink-0" />
          <span>Backups and exports made with your current password won't open after this change — you'll be able to update them on the next screen.</span>
        </div>

        <p
          v-if="error"
          class="text-sm text-expense"
        >
          {{ error }}
        </p>

        <div class="flex items-center justify-end gap-3">
          <button
            type="button"
            class="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            @click="close"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="submitting"
            class="inline-flex items-center px-4 py-2 bg-primary-500 dark:bg-primary-900/40 text-white dark:text-primary-300 hover:bg-primary-600 dark:hover:bg-primary-900/60 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm transition-colors"
          >
            <i
              v-if="submitting"
              class="pi pi-spin pi-spinner mr-2"
            />
            Change Password
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
