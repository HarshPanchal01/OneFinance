<script setup lang="ts">
import { ref } from 'vue';

const isOpen = ref(false);
let resolveCallback: ((didEnable: boolean) => void) | null = null;

function open(): Promise<boolean> {
  isOpen.value = true;
  return new Promise((resolve) => {
    resolveCallback = resolve;
  });
}

async function handleSetUp() {
  const result = await window.electronAPI.selectBackupFolder();
  if (!result.canceled && result.folder) {
    await window.electronAPI.saveBackupSettings({ folder: result.folder, enabled: true });
    isOpen.value = false;
    resolveCallback?.(true);
    resolveCallback = null;
  }
  // If the user cancels the folder dialog, keep the modal open so they can try again or dismiss
}

function handleDismiss() {
  isOpen.value = false;
  resolveCallback?.(false);
  resolveCallback = null;
}

defineExpose({ open });
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
  >
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-[440px] overflow-hidden relative">
      <button
        class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors z-10"
        @click="handleDismiss"
      >
        <i class="pi pi-times text-sm" />
      </button>
      <!-- Header band -->
      <div class="bg-primary-500/10 dark:bg-primary-500/10 px-6 pt-8 pb-6 flex flex-col items-center text-center">
        <div class="w-14 h-14 rounded-full bg-primary-500/15 dark:bg-primary-500/20 flex items-center justify-center mb-4">
          <i class="pi pi-history text-2xl text-primary-500" />
        </div>
        <h2 class="text-lg font-bold text-gray-900 dark:text-white mb-2">
          Protect Your Financial Data
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          OneFinance can automatically back up your data to a folder of your choice — daily or weekly — so you always have a recent recovery point.
        </p>
      </div>

      <!-- Body -->
      <div class="px-6 py-5 space-y-3">
        <div class="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-300">
          <i class="pi pi-check-circle text-green-500 mt-0.5 flex-shrink-0" />
          <span>Files overwritten — no storage bloat</span>
        </div>
        <div class="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-300">
          <i class="pi pi-check-circle text-green-500 mt-0.5 flex-shrink-0" />
          <span>Runs silently in the background</span>
        </div>
        <div class="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-300">
          <i class="pi pi-check-circle text-green-500 mt-0.5 flex-shrink-0" />
          <span>Compatible with the existing Import feature</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="px-6 pb-6 flex items-center justify-center gap-3">
        <button
          class="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          @click="handleDismiss"
        >
          Maybe Later
        </button>
        <button
          class="inline-flex items-center px-4 py-2 bg-primary-500 dark:bg-primary-900/40 text-white dark:text-primary-300 hover:bg-primary-600 dark:hover:bg-primary-900/60 rounded-lg text-sm transition-colors"
          @click="handleSetUp"
        >
          <i class="pi pi-folder-open mr-2" />
          Choose Backup Folder
        </button>
      </div>
    </div>
  </div>
</template>
