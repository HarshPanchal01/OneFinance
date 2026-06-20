<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useAuthStore } from "@/stores/auth";
import PasswordInput from "@/components/PasswordInput.vue";

const emit = defineEmits<{ (e: "unlocked"): void }>();

// When the gate reappears after a mid-session lock (idle / manual / OS lock), the
// remembered-key auto-unlock is suppressed — otherwise it would instantly undo the
// lock. Only the first launch allows auto-unlock.
const props = withDefaults(defineProps<{ allowAutoUnlock?: boolean }>(), {
  allowAutoUnlock: true,
});

const auth = useAuthStore();

const loading = ref(true);
const submitting = ref(false);
const password = ref("");
const confirmPassword = ref("");
const error = ref("");

const isCreate = computed(() => !auth.hasMasterPassword);
const MIN_LENGTH = 8;

onMounted(async () => {
  await auth.checkStatus();
  // Already unlocked (e.g. renderer reloaded in dev while main stayed unlocked).
  if (auth.isUnlocked) {
    emit("unlocked");
    return;
  }
  // Returning user within a still-valid remember-window → open without prompting.
  // Skipped after a mid-session lock so the lock isn't immediately undone.
  if (auth.hasMasterPassword && props.allowAutoUnlock) {
    const auto = await auth.tryAutoUnlock();
    if (auto.success) {
      emit("unlocked");
      return;
    }
  }
  loading.value = false;
});

async function submit() {
  error.value = "";
  if (!password.value) {
    error.value = "Please enter a password.";
    return;
  }
  if (isCreate.value) {
    if (password.value.length < MIN_LENGTH) {
      error.value = `Password must be at least ${MIN_LENGTH} characters.`;
      return;
    }
    if (password.value !== confirmPassword.value) {
      error.value = "Passwords do not match.";
      return;
    }
  }

  submitting.value = true;
  try {
    // The remember policy is chosen in Settings; on unlock we re-arm whatever the
    // user already chose (defaults to 'session' on first-run create). Main normalizes
    // to 'session' if the OS keychain isn't available.
    const result = isCreate.value
      ? await auth.create(password.value, auth.rememberPolicy)
      : await auth.unlock(password.value, auth.rememberPolicy);
    if (result.success) {
      password.value = "";
      confirmPassword.value = "";
      emit("unlocked");
    } else {
      error.value = result.error || "Something went wrong. Please try again.";
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="fixed inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
    <div
      v-if="loading"
      class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500"
    />

    <div
      v-else
      class="w-[420px] max-w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl overflow-hidden"
    >
      <!-- Header band -->
      <div class="bg-primary-500/10 px-6 pt-8 pb-6 flex flex-col items-center text-center">
        <div class="w-14 h-14 rounded-full bg-primary-500/15 flex items-center justify-center mb-4">
          <i class="pi pi-lock text-2xl text-primary-500" />
        </div>
        <h2 class="text-lg font-bold text-gray-900 dark:text-white mb-2">
          {{ isCreate ? "Create Master Password" : "Enter Master Password" }}
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          {{ isCreate
            ? "Your financial data is encrypted with this password. Keep it somewhere safe."
            : "Enter your master password to unlock your data." }}
        </p>
      </div>

      <!-- Form -->
      <form
        class="px-6 py-5 space-y-4"
        @submit.prevent="submit"
      >
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ isCreate ? "New password" : "Master password" }}
          </label>
          <PasswordInput
            v-model="password"
            autofocus
          />
        </div>

        <div v-if="isCreate">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Confirm password
          </label>
          <PasswordInput v-model="confirmPassword" />
        </div>

        <div
          v-if="isCreate"
          class="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3"
        >
          <i class="pi pi-exclamation-triangle mt-0.5 flex-shrink-0" />
          <span>There is no way to recover your data if you forget this password. Store it somewhere safe.</span>
        </div>

        <p
          v-if="error"
          class="text-sm text-expense"
        >
          {{ error }}
        </p>

        <div class="flex justify-center pt-1">
          <button
            type="submit"
            :disabled="submitting"
            class="inline-flex items-center justify-center px-6 py-2 bg-primary-500 dark:bg-primary-900/40 text-white dark:text-primary-300 hover:bg-primary-600 dark:hover:bg-primary-900/60 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
          >
            <i
              v-if="submitting"
              class="pi pi-spin pi-spinner mr-2"
            />
            {{ isCreate ? "Create & Unlock" : "Unlock" }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
