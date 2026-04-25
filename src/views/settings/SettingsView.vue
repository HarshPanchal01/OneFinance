<script setup lang="ts">
import { ref, onMounted } from "vue";
import ConfirmationModal from "@/components/ConfirmationModal.vue";
import ErrorModal from "@/components/ErrorModal.vue";
import NotificationModal from "@/components/NotificationModal.vue";
import SettingsImportModal from "./components/SettingsImportModal.vue";
import { useDataManagement } from "@/composables/useDataManagement";
import { useSettingsStore, regionalSettings } from "@/stores/settings";
import Select from "primevue/select";
import iconSvg from "@/assets/icon.svg";
import logoPng from "@/assets/logo.png";

const appVersion = "1.1.0";
const logoUrl = ref(iconSvg);
const dbPath = ref("");
const confirmModal = ref<InstanceType<typeof ConfirmationModal>>();
const errorModal = ref<InstanceType<typeof ErrorModal>>();
const notificationModal = ref<InstanceType<typeof NotificationModal>>();
const actionModal = ref<InstanceType<typeof SettingsImportModal>>();
const settingsStore = useSettingsStore();

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
  { keys: ["Ctrl", "R"], description: "Go to Recurring" },
  { keys: ["Ctrl", "I"], description: "Go to Insights" },
  { keys: ["Ctrl", "Shift", "C"], description: "Go to Categories" },
  { keys: ["Ctrl", "Shift", "A"], description: "Go to Accounts" },
  { keys: ["Ctrl", "Shift", "S"], description: "Go to Settings" },
  { keys: ["/"], description: "Go to Search Bar" },
];

// Load DB path and platform logo on mount
onMounted(async () => {
  dbPath.value = await window.electronAPI.getDbPath();
  const platform = await window.electronAPI.getPlatform();
  if (platform === "win32") {
    logoUrl.value = logoPng;
  } else {
    logoUrl.value = iconSvg;
  }
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
</script>

<template>
  <div class="h-full overflow-y-auto pr-2 pb-6">
    <div class="max-w-6xl mx-auto space-y-6 py-8 px-4">
      <!-- App Info -->
      <div class="card p-6">
        <div class="flex items-center space-x-4 mb-4">
          <img
            :src="logoUrl"
            alt="OneFinance"
            class="w-16 h-16 rounded-2xl"
          />
          <div>
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">
              OneFinance
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Version {{ appVersion }}
            </p>
          </div>
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
                :class="settingsStore.privacyMode ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'"
                @click="settingsStore.togglePrivacyMode()"
              >
                <span
                  aria-hidden="true"
                  class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                  :class="settingsStore.privacyMode ? 'translate-x-5' : 'translate-x-0'"
                />
              </button>
            </div>
            <p class="text-[10px] text-gray-500 mt-1">
              Obfuscate data on hover
            </p>
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
        </div>
      </div>

      <!-- Developer Options -->
      <div class="card p-6 border-2 border-dashed border-expense/30">
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
</template>
