<script setup lang="ts">
import { ref } from "vue";
import { useFormatter } from "@/composables/useFormatter";
import type { SavingsGoal } from "@/types";

defineProps<{
  goal: SavingsGoal;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "add", amount: number): void;
}>();

const { getCurrencySymbol, formatCurrency } = useFormatter();

const amount = ref<number | null>(null);

const isValid = () => amount.value != null && amount.value > 0;

function save() {
  if (!isValid()) return;
  emit("add", amount.value as number);
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div
        class="absolute inset-0 bg-black/50"
        @click="emit('close')"
      />

      <div
        class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mx-4 flex flex-col"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0"
        >
          <div class="min-w-0">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white truncate">
              Add Funds
            </h3>
            <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
              {{ goal.name }} · {{ formatCurrency(goal.currentAmount) }} saved
            </p>
          </div>
          <button
            class="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors shrink-0"
            @click="emit('close')"
          >
            <i class="pi pi-times" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-6">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Amount to add
          </label>
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
              {{ getCurrencySymbol() }}
            </span>
            <input
              v-model.number="amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              autofocus
              class="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              @keydown.enter="save"
            />
          </div>
        </div>

        <!-- Footer -->
        <div
          class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0"
        >
          <button
            class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            @click="emit('close')"
          >
            Cancel
          </button>
          <button
            :disabled="!isValid()"
            class="px-4 py-2 bg-primary-500 dark:bg-primary-900/40 text-white dark:text-primary-300 hover:bg-primary-600 dark:hover:bg-primary-900/60 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            @click="save"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
