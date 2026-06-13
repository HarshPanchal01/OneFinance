<script setup lang="ts">
import { ref } from 'vue';

const isOpen = ref(false);
const title = ref('Confirm');
const message = ref('Are you sure?');
const cancelText = ref('Cancel');
const confirmText = ref('Confirm');
const confirmButtonClass = ref('bg-red-500 dark:bg-red-900/40 text-white dark:text-red-300 hover:bg-red-600 dark:hover:bg-red-900/60');
const showDontAskAgain = ref(false);
const dontAskAgain = ref(false);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let resolveCallback: ((result: any) => void) | null = null;
let returnsObject = false;

function openConfirmation(options: {
  title: string;
  message: string;
  cancelText?: string;
  confirmText?: string;
  confirmButtonClass?: string;
  showDontAskAgain?: boolean;
}): Promise<any> {
  title.value = options.title;
  message.value = options.message;
  cancelText.value = options.cancelText ?? 'Cancel';
  confirmText.value = options.confirmText ?? 'Confirm';
  confirmButtonClass.value = options.confirmButtonClass ?? 'bg-red-500 hover:bg-red-600';
  showDontAskAgain.value = options.showDontAskAgain ?? false;
  dontAskAgain.value = false;
  isOpen.value = true;
  returnsObject = options.showDontAskAgain ?? false;

  return new Promise((resolve) => {
    resolveCallback = resolve;
  });
}

function handleConfirm() {
  isOpen.value = false;
  if (resolveCallback) {
    if (returnsObject) {
      resolveCallback({ confirmed: true, dontAskAgain: dontAskAgain.value });
    } else {
      resolveCallback(true);
    }
    resolveCallback = null;
  }
}

function handleCancel() {
  isOpen.value = false;
  if (resolveCallback) {
    if (returnsObject) {
      resolveCallback({ confirmed: false, dontAskAgain: dontAskAgain.value });
    } else {
      resolveCallback(false);
    }
    resolveCallback = null;
  }
}

function handleDismiss() {
  isOpen.value = false;
  if (resolveCallback) {
    // Object-mode callers (showDontAskAgain) expect result.confirmed to exist — give them a safe cancel shape.
    // Simple-mode callers (backup override) use null to distinguish X from the Cancel button option.
    resolveCallback(returnsObject ? { confirmed: false, dontAskAgain: false } : null);
    resolveCallback = null;
  }
}

defineExpose({ openConfirmation });
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
  >
    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg w-96 shadow-lg relative">
      <button
        class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        @click="handleDismiss"
      >
        <i class="pi pi-times text-sm" />
      </button>
      <h2 class="text-lg font-bold mb-4 text-gray-900 dark:text-white pr-6">
        {{ title }}
      </h2>
      <p class="text-gray-600 dark:text-gray-300 mb-6">
        {{ message }}
      </p>

      <div
        v-if="showDontAskAgain"
        class="mb-4 flex items-center"
      >
        <input 
          id="dontAskAgain" 
          v-model="dontAskAgain" 
          type="checkbox"
          class="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
        />
        <label
          for="dontAskAgain"
          class="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300 cursor-pointer"
        >
          Don't ask again
        </label>
      </div>

      <div class="flex justify-end space-x-3 pt-4">
        <button
          class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          @click="handleCancel"
        >
          {{ cancelText }}
        </button>
        <button
          :class="['px-4 py-2 rounded-lg transition-colors', confirmButtonClass]"
          @click="handleConfirm"
        >
          {{ confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>