<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{
  visible: boolean;
  year: number | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "confirm", deleteTransactions: boolean): void;
}>();

const deleteTransactions = ref(false);

// Reset state when modal opens
watch(
  () => props.visible,
  (val) => {
    if (val) {
      deleteTransactions.value = false;
    }
  }
);

function close() {
  emit("close");
}

function confirm() {
  emit("confirm", deleteTransactions.value);
  close();
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible && year"
      class="fixed inset-0 z-50 flex items-center justify-center"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/50"
        @click="close"
      />

      <!-- Modal -->
      <div
        class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6"
      >
        <div class="mb-4">
          <div
            class="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4"
          >
            <i class="pi pi-exclamation-triangle text-xl text-red-600 dark:text-red-400" />
          </div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            Delete Year {{ year }}
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
            You are about to delete the year <strong>{{ year }}</strong> from the ledger.
          </p>
        </div>

        <!-- Options -->
        <div class="space-y-4 mb-6">
          <!-- Keep Transactions Option -->
          <div class="flex items-start">
            <div class="flex items-center h-5">
              <input
                id="opt-keep"
                :checked="!deleteTransactions"
                type="radio"
                class="focus:ring-primary-500 h-4 w-4 text-primary-600 border-gray-300"
                @change="deleteTransactions = false"
              />
            </div>
            <div class="ml-3 text-sm">
              <label
                for="opt-keep"
                class="font-medium text-gray-700 dark:text-gray-300"
              >Keep transactions</label>
              <p class="text-gray-500 dark:text-gray-400">
                Remove {{ year }} from the list, but keep its transactions in the database (visible in All Transactions).
              </p>
            </div>
          </div>

          <!-- Delete Transactions Option -->
          <div class="flex items-start">
            <div class="flex items-center h-5">
              <input
                id="opt-delete"
                :checked="deleteTransactions"
                type="radio"
                class="focus:ring-red-500 h-4 w-4 text-red-600 border-gray-300"
                @change="deleteTransactions = true"
              />
            </div>
            <div class="ml-3 text-sm">
              <label
                for="opt-delete"
                class="font-medium text-gray-700 dark:text-gray-300"
              >Delete transactions</label>
              <p class="text-gray-500 dark:text-gray-400">
                Permanently delete all transactions dated in {{ year }}.
              </p>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex justify-end space-x-3">
          <button
            class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            @click="close"
          >
            Cancel
          </button>
          <button
            class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            @click="confirm"
          >
            Delete Year
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
