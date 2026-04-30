<script setup lang="ts">
import { ref } from 'vue';
import { useFinanceStore } from '@/stores/finance';

const props = defineProps<{
  accountId: number;
  currentCash: number;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved'): void;
}>();

const store = useFinanceStore();

const amount = ref<number | null>(null);
const notes = ref("Dividend / Cash Adjustment");
const isSubmitting = ref(false);

async function submit() {
  if (amount.value === null) return;
  
  isSubmitting.value = true;
  try {
    // Calculate the difference between target and current
    const diff = amount.value - props.currentCash;
    if (diff !== 0) {
      await window.electronAPI.adjustAccountCash(props.accountId, diff, notes.value);
      await store.fetchAccounts();
    }
    emit('saved');
  } catch (error) {
    console.error("Error adjusting cash:", error);
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        class="absolute inset-0 bg-black/50"
        @click="emit('close')"
      />
      <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
        <div class="p-6 border-b border-gray-100 dark:border-gray-700">
          <h3 class="text-xl font-bold text-gray-900 dark:text-white">
            Adjust Cash Balance
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Update the uninvested cash for this account.
          </p>
        </div>

        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Cash Total</label>
            <input
              v-model.number="amount"
              type="number"
              step="any"
              :placeholder="currentCash.toFixed(2)"
              class="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason / Notes</label>
            <input
              v-model="notes"
              type="text"
              class="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>
        </div>

        <div class="p-6 border-t border-gray-100 dark:border-gray-700 flex justify-end space-x-3">
          <button
            class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            @click="emit('close')"
          >
            Cancel
          </button>
          <button
            class="px-6 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-bold rounded-lg transition-colors flex items-center"
            :disabled="amount === null || isSubmitting"
            @click="submit"
          >
            <i
              v-if="isSubmitting"
              class="pi pi-spinner animate-spin mr-2"
            />
            Update Cash
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>