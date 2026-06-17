<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import ConfirmationModal from "@/components/ConfirmationModal.vue";
import ErrorModal from "@/components/ErrorModal.vue";
import NotificationModal from "@/components/NotificationModal.vue";
import SettingsImportModal from "./components/SettingsImportModal.vue";
import ChangePasswordModal from "./components/ChangePasswordModal.vue";
import { useDataManagement } from "@/composables/useDataManagement";
import { useSettingsStore, regionalSettings } from "@/stores/settings";
import { useAuthStore } from "@/stores/auth";
import { REMEMBER_POLICY_OPTIONS, type RememberPolicy } from "@/types";
import Select from "primevue/select";
import lockupMacDark from "@/assets/onefinance_lockup_mac_dark.png";
import lockupMacLight from "@/assets/onefinance_lockup_mac_light.png";
import lockupWinDark from "@/assets/onefinance_lockup_win_dark.png";
import lockupWinLight from "@/assets/onefinance_lockup_win_light.png";

const backupFrequencyOptions = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
];

const appVersion = "2.0.0";
const isWindows = ref(false);
const dbPath = ref("");
const confirmModal = ref<InstanceType<typeof ConfirmationModal>>();
const errorModal = ref<InstanceType<typeof ErrorModal>>();
const notificationModal = ref<InstanceType<typeof NotificationModal>>();
const actionModal = ref<InstanceType<typeof SettingsImportModal>>();
const changePasswordModal = ref<InstanceType<typeof ChangePasswordModal>>();
const settingsStore = useSettingsStore();
const auth = useAuthStore();

const logoUrl = computed(() => {
  if (isWindows.value) {
    return settingsStore.isDark ? lockupWinDark : lockupWinLight;
  }
  return settingsStore.isDark ? lockupMacDark : lockupMacLight;
});

// Two-way bound to the master-password remember policy; setting it persists via IPC
// (Main reuses the in-memory session password to re-arm the window).
const rememberPolicy = computed<RememberPolicy>({
  get: () => auth.rememberPolicy,
  set: (value) => { void auth.setRememberPolicy(value); },
});

const isDev = import.meta.env.DEV;

const {
  openDbLocation: _openDbLocation,
  deleteDatabase: _deleteDatabase,
  exportData: _exportData,
  importData: _importData,
} = useDataManagement();

// Keyboard shortcuts
const shortcuts = [
  { keys: ["Ctrl", "N"], description: "New transaction" },
  { keys: ["Ctrl", "D"], description: "Go to Dashboard" },
  { keys: ["Ctrl", "T"], description: "Go to Transactions" },
  { keys: ["Ctrl", "S"], description: "Go to Schedules" },
  { keys: ["Ctrl", "I"], description: "Go to General Insights" },
  { keys: ["Ctrl", "P"], description: "Go to Portfolio Insights" },
  { keys: ["Ctrl", "L"], description: "Go to Labels" },
  { keys: ["Ctrl", "Shift", "A"], description: "Go to Accounts" },
  { keys: ["Ctrl", "Shift", "I"], description: "Go to Investments" },
  { keys: ["Ctrl", "Shift", "S"], description: "Go to Settings" },
  { keys: ["Ctrl", "Shift", "P"], description: "Toggle Privacy Mode" },
  { keys: ["/"], description: "Go to Search Bar (While on Transactions Page)" },
];

// Load DB path and platform logo on mount
onMounted(async () => {
  // Refresh remember-policy + keychain availability for the Security control.
  void auth.checkStatus();
  dbPath.value = await window.electronAPI.getDbPath();
  isWindows.value = (await window.electronAPI.getPlatform()) === "win32";
});

// Wrappers for composable functions to pass modal refs
async function openDbLocation() {
  await _openDbLocation();
}

async function deleteDatabase() {
  await _deleteDatabase(
    confirmModal.value,
    notificationModal.value,
    errorModal.value,
  );
}

async function exportData() {
  await _exportData(notificationModal.value);
}

async function importData() {
  await _importData(
    errorModal.value,
    actionModal.value,
    notificationModal.value,
  );
}

async function chooseBackupFolder() {
  const result = await window.electronAPI.selectBackupFolder();
  if (!result.canceled && result.folder) {
    settingsStore.backupFolder = result.folder;
  }
}

async function runBackupNow() {
  const { exists } = await window.electronAPI.getLatestManualBackup();

  let override = false;
  if (exists) {
    const confirmed = await confirmModal.value?.openConfirmation({
      title: 'Manual Backup',
      message: 'You already have a manual backup saved. Override it, or keep it and save a new file alongside it?',
      confirmText: 'Override',
      cancelText: 'Keep',
      confirmButtonClass: 'bg-primary-500 dark:bg-primary-900/40 text-white dark:text-primary-300 hover:bg-primary-600 dark:hover:bg-primary-900/60',
    });
    if (confirmed === null || confirmed === undefined) return;
    override = confirmed === true;
  }

  const result = await window.electronAPI.runBackupNow('manual', override);
  if (result.success) {
    await notificationModal.value?.openConfirmation({
      title: 'Backup Saved',
      message: 'Your data has been backed up successfully.',
      confirmText: 'Okay',
    });
    await settingsStore.refreshLastBackupDate();
  } else {
    await errorModal.value?.openConfirmation({
      title: 'Backup Failed',
      message: 'Could not write to the backup folder. Please check that the folder exists and is writable.',
      confirmText: 'Okay',
    });
  }
}
</script>

<template>
  <div class="h-full overflow-y-auto pr-2 pb-6">
    <div class="max-w-6xl mx-auto space-y-6 py-8 px-4">
      <!-- App Info -->
      <div class="card p-6">
        <div class="mb-4">
          <img
            :src="logoUrl"
            alt="OneFinance"
            class="h-12 w-auto max-w-full mb-1"
          />
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Version {{ appVersion }}
          </p>
        </div>

        <p class="text-gray-600 dark:text-gray-300">
          A local-first personal finance manager. Your data stays on your device,
          giving you complete privacy and control over your financial information.
        </p>
      </div>

      <!-- Keyboard Shortcuts -->
      <div class="card p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <i class="pi pi-th-large mr-2 text-gray-700 dark:text-white" />
          Keyboard Shortcuts
        </h3>

        <div class="space-y-3">
          <div
            v-for="shortcut in shortcuts"
            :key="shortcut.description"
            class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
          >
            <span class="text-gray-600 dark:text-gray-300">{{
              shortcut.description
            }}</span>
            <div class="flex items-center space-x-1">
              <kbd
                v-for="key in shortcut.keys"
                :key="key"
                class="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded border border-gray-300 dark:border-gray-600"
              >
                {{ key }}
              </kbd>
            </div>
          </div>
        </div>
      </div>

      <!-- General Preferences -->
      <div class="card p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
          <i class="pi pi-cog mr-2 text-gray-700 dark:text-white" />
          General Preferences
        </h3>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
          <!-- Appearance -->
          <div class="flex flex-col bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800 transition-all">
            <div class="flex items-center gap-2 mb-1 text-sm font-bold text-gray-800 dark:text-gray-200">
              <i class="pi pi-palette text-primary-500" />
              Appearance
            </div>
            <p class="text-xs text-gray-500 mb-4">
              Theme (Light, Dark, System)
            </p>
            <div class="mt-auto">
              <Select
                v-model="settingsStore.appearance"
                :options="[
                  { label: 'System', value: 'system' },
                  { label: 'Light', value: 'light' },
                  { label: 'Dark', value: 'dark' },
                ]"
                option-label="label"
                option-value="value"
                class="w-full"
              />
            </div>
          </div>

          <!-- Localization -->
          <div class="flex flex-col bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800 transition-all">
            <div class="flex items-center gap-2 mb-1 text-sm font-bold text-gray-800 dark:text-gray-200">
              <i class="pi pi-globe text-primary-500" />
              Localization
            </div>
            <p class="text-xs text-gray-500 mb-4">
              Region, date & currency
            </p>
            <div class="mt-auto">
              <Select
                v-model="settingsStore.region"
                :options="regionalSettings"
                option-label="label"
                option-value="value"
                class="w-full"
                placeholder="Select a region"
              />
            </div>
          </div>

          <!-- Privacy -->
          <div class="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800 transition-all">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-200">
                <i class="pi pi-shield text-primary-500" />
                Privacy Mode
              </div>
              <button
                type="button"
                role="switch"
                :aria-checked="settingsStore.privacyMode"
                class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                :class="settingsStore.privacyMode ? 'bg-primary-500 dark:bg-primary-500/30' : 'bg-gray-200 dark:bg-gray-700'"
                @click="settingsStore.togglePrivacyMode()"
              >
                <span
                  aria-hidden="true"
                  class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                  :class="settingsStore.privacyMode ? 'translate-x-5' : 'translate-x-0'"
                />
              </button>
            </div>
            <p class="text-xs text-gray-500 mt-1">
              Obfuscate data on hover
            </p>
          </div>

          <!-- Keep running in tray -->
          <div class="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800 transition-all">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-200">
                <i class="pi pi-window-minimize text-primary-500" />
                Keep Running in Tray
              </div>
              <button
                type="button"
                role="switch"
                :aria-checked="settingsStore.minimizeToTray"
                class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                :class="settingsStore.minimizeToTray ? 'bg-primary-500 dark:bg-primary-500/30' : 'bg-gray-200 dark:bg-gray-700'"
                @click="settingsStore.minimizeToTray = !settingsStore.minimizeToTray"
              >
                <span
                  aria-hidden="true"
                  class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                  :class="settingsStore.minimizeToTray ? 'translate-x-5' : 'translate-x-0'"
                />
              </button>
            </div>
            <p class="text-xs text-gray-500 mt-1">
              Closing hides to tray so reminders keep firing
            </p>
          </div>

          <!-- Start on login -->
          <div class="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800 transition-all">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-200">
                <i class="pi pi-power-off text-primary-500" />
                Start on Login
              </div>
              <button
                type="button"
                role="switch"
                :aria-checked="settingsStore.openAtLogin"
                class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                :class="settingsStore.openAtLogin ? 'bg-primary-500 dark:bg-primary-500/30' : 'bg-gray-200 dark:bg-gray-700'"
                @click="settingsStore.openAtLogin = !settingsStore.openAtLogin"
              >
                <span
                  aria-hidden="true"
                  class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                  :class="settingsStore.openAtLogin ? 'translate-x-5' : 'translate-x-0'"
                />
              </button>
            </div>
            <p class="text-xs text-gray-500 mt-1">
              Launch OneFinance automatically when you sign in
            </p>
          </div>
        </div>
      </div>

      <!-- Security -->
      <div class="card p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-1 flex items-center">
          <i class="pi pi-lock mr-2 text-gray-700 dark:text-white" />
          Security
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Manage the master password that encrypts your data and how long OneFinance stays unlocked.
        </p>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
          <!-- Master Password -->
          <div class="flex flex-col bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800 transition-all">
            <div class="flex items-center gap-2 mb-1 text-sm font-bold text-gray-800 dark:text-gray-200">
              <i class="pi pi-key text-primary-500" />
              Master Password
            </div>
            <p class="text-xs text-gray-500 mb-4">
              The password that encrypts your data
            </p>
            <div class="mt-auto">
              <button
                class="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                @click="changePasswordModal?.open()"
              >
                <i class="pi pi-pencil mr-1.5" />
                Change Password
              </button>
            </div>
          </div>

          <!-- Stay Unlocked -->
          <div class="flex flex-col bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800 transition-all">
            <div class="flex items-center gap-2 mb-1 text-sm font-bold text-gray-800 dark:text-gray-200">
              <i class="pi pi-clock text-primary-500" />
              Stay Unlocked
            </div>
            <p class="text-xs text-gray-500 mb-4">
              How long before asking for your password again
            </p>
            <div class="mt-auto">
              <Select
                v-if="auth.canRemember"
                v-model="rememberPolicy"
                :options="REMEMBER_POLICY_OPTIONS"
                option-label="label"
                option-value="value"
                class="w-full"
              />
              <p
                v-else
                class="text-xs text-gray-500 dark:text-gray-400"
              >
                Unavailable — no secure keychain on this system, so OneFinance always asks on launch.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Data Management -->
      <div class="card p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          <i class="pi pi-database mr-2" />
          Data Management
        </h3>

        <div class="space-y-4">
          <div>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Your data is stored locally in a SQLite database on your computer.
              No data is sent to any external servers.
            </p>
            <p
              class="text-xs text-gray-500 dark:text-gray-500 font-mono break-all"
            >
              {{ dbPath }}
            </p>
          </div>

          <div class="flex flex-wrap gap-3">
            <button
              class="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              @click="openDbLocation"
            >
              <i class="pi pi-folder-open mr-2" />
              Open DB Location
            </button>
            <button
              class="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              @click="exportData"
            >
              <i class="pi pi-download mr-2" />

              Export Data
            </button>
            <button
              class="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              @click="importData"
            >
              <i class="pi pi-upload mr-2" />
              Import Data
            </button>
          </div>

          <!-- Automated Backups -->
          <div class="pt-4 border-t border-gray-100 dark:border-gray-800">
            <div class="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <i class="pi pi-clone text-gray-700 dark:text-white" />
              Automated Backups
            </div>
            <p class="text-xs text-gray-500 mb-4">
              Automatically save a copy of your data to a folder on a schedule. Keeps the 5 most recent.
            </p>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
              <!-- Enable toggle + Backup Now -->
              <div class="flex flex-col bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800 transition-all">
                <div class="flex items-center justify-between mb-1">
                  <div class="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-200">
                    <i class="pi pi-history text-primary-500" />
                    Auto Backup
                  </div>
                  <button
                    type="button"
                    role="switch"
                    :aria-checked="settingsStore.backupEnabled"
                    class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                    :class="settingsStore.backupEnabled ? 'bg-primary-500 dark:bg-primary-500/30' : 'bg-gray-200 dark:bg-gray-700'"
                    @click="settingsStore.backupEnabled = !settingsStore.backupEnabled"
                  >
                    <span
                      aria-hidden="true"
                      class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                      :class="settingsStore.backupEnabled ? 'translate-x-5' : 'translate-x-0'"
                    />
                  </button>
                </div>
                <p class="text-xs text-gray-500 mb-3">
                  Periodically save a full copy of your data
                </p>
                <div class="mt-auto flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <button
                    class="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    :disabled="!settingsStore.backupFolder"
                    @click="runBackupNow"
                  >
                    <i class="pi pi-save mr-1.5" />
                    Backup Now
                  </button>
                  <span class="text-xs text-gray-500 dark:text-gray-400 truncate">
                    <template v-if="settingsStore.lastBackupDate">{{ settingsStore.lastBackupDate }}</template>
                    <template v-else>Never backed up</template>
                  </span>
                </div>
              </div>

              <!-- Backup Folder -->
              <div
                class="flex flex-col bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800 transition-all"
                :class="{ 'opacity-40 pointer-events-none': !settingsStore.backupEnabled }"
              >
                <div class="flex items-center gap-2 mb-1 text-sm font-bold text-gray-800 dark:text-gray-200">
                  <i class="pi pi-folder text-primary-500" />
                  Backup Folder
                </div>
                <p class="text-xs text-gray-500 mb-3">
                  <span
                    v-if="settingsStore.backupFolder"
                    class="font-mono break-all"
                  >{{ settingsStore.backupFolder }}</span>
                  <span
                    v-else
                    class="italic"
                  >No folder selected</span>
                </p>
                <div class="mt-auto flex items-center gap-2">
                  <button
                    class="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    @click="chooseBackupFolder"
                  >
                    <i class="pi pi-folder-open mr-1.5" />
                    Choose Folder
                  </button>
                  <span
                    v-if="settingsStore.backupEnabled && !settingsStore.backupFolder"
                    class="text-[10px] text-amber-500 dark:text-amber-400 flex items-center gap-1"
                  >
                    <i class="pi pi-exclamation-triangle" />
                    Required
                  </span>
                </div>
              </div>

              <!-- Frequency -->
              <div
                class="flex flex-col bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800 transition-all"
                :class="{ 'opacity-40 pointer-events-none': !settingsStore.backupEnabled }"
              >
                <div class="flex items-center gap-2 mb-1 text-sm font-bold text-gray-800 dark:text-gray-200">
                  <i class="pi pi-calendar text-primary-500" />
                  Frequency
                </div>
                <p class="text-xs text-gray-500 mb-4">
                  How often to save a backup
                </p>
                <div class="mt-auto">
                  <Select
                    v-model="settingsStore.backupFrequency"
                    :options="backupFrequencyOptions"
                    option-label="label"
                    option-value="value"
                    class="w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Developer Options -->
      <div
        v-if="isDev"
        class="card p-6 border-2 border-dashed border-expense/30"
      >
        <h3
          class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center"
        >
          <i class="pi pi-code mr-2 text-expense" />
          Developer Options
          <span class="ml-2 px-2 py-0.5 text-xs bg-expense/10 text-expense rounded">
            DEV
          </span>
        </h3>

        <div class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            ⚠️ These options are for development and testing purposes only. Use
            with caution.
          </p>

          <button
            class="inline-flex items-center px-4 py-2 bg-expense/10 border border-expense/30 rounded-lg text-expense hover:bg-expense/20 transition-colors"
            @click="deleteDatabase"
          >
            <i class="pi pi-trash mr-2" />
            Delete Database
          </button>
        </div>
      </div>

      <!-- About -->
      <div class="card p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          <i class="pi pi-info-circle mr-2" />
          About
        </h3>

        <div class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <p>
            <strong class="text-gray-900 dark:text-white">Built with:</strong>
            Vue 3, TypeScript, Tailwind CSS, PrimeVue, Electron
          </p>
          <p>
            <strong class="text-gray-900 dark:text-white">Database:</strong>
            SQLite (better-sqlite3)
          </p>
          <p>
            <strong class="text-gray-900 dark:text-white">License:</strong>
            MIT
          </p>
        </div>
      </div>
    </div>
  </div>
  <ConfirmationModal ref="confirmModal" />
  <ErrorModal ref="errorModal" />
  <NotificationModal ref="notificationModal" />
  <SettingsImportModal ref="actionModal" />
  <ChangePasswordModal ref="changePasswordModal" />
</template>
