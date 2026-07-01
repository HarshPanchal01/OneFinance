<script setup lang="ts">
import { computed, ref } from "vue";
import { useFinanceStore } from "@/stores/finance";
import { useFormatter } from "@/composables/useFormatter";
import type { SavingsGoal } from "@/types";

const props = defineProps<{
  goal: SavingsGoal | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", payload: {
    id?: number;
    name: string;
    targetAmount: number;
    targetDate: string | null;
    accountId: number | null;
    currentAmount: number;
  }): void;
  (e: "remove"): void;
}>();

const store = useFinanceStore();
const { getCurrencySymbol } = useFormatter();

const isEdit = computed(() => props.goal != null);

function accountBalance(id: number): number {
  return store.accounts.find((a) => a.id === id)?.balance ?? 0;
}

const name = ref<string>(props.goal?.name ?? "");
const targetAmount = ref<number | null>(props.goal?.targetAmount ?? null);
const targetDate = ref<string>(props.goal?.targetDate ?? "");
const accountId = ref<number | null>(props.goal?.accountId ?? null);
// For a linked goal, currentAmount is stored as 0; prefill from the live balance
// so that switching to "Track manually" keeps the real saved amount.
const currentAmount = ref<number | null>(
  props.goal?.accountId != null
    ? accountBalance(props.goal.accountId)
    : (props.goal?.currentAmount ?? null)
);

// Only liquid accounts (cash / chequing / savings) make sense as a savings pot —
// investment, asset and liability accounts are excluded.
const liquidAccounts = computed(() =>
  store.accounts.filter((a) => {
    const type = store.accountTypes.find((at) => at.id === a.accountTypeId);
    return type?.classification === "liquid";
  })
);

const isLinked = computed(() => accountId.value != null);

const isValid = () =>
  name.value.trim().length > 0 && targetAmount.value != null && targetAmount.value > 0;

function save() {
  if (!isValid()) return;
  emit("save", {
    id: props.goal?.id,
    name: name.value.trim(),
    targetAmount: targetAmount.value as number,
    targetDate: targetDate.value ? targetDate.value : null,
    accountId: accountId.value,
    currentAmount: isLinked.value ? 0 : (currentAmount.value ?? 0),
  });
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
        class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 flex flex-col"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0"
        >
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ isEdit ? "Edit Goal" : "New Goal" }}
          </h3>
          <button
            class="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
            @click="emit('close')"
          >
            <i class="pi pi-times" />
          </button>
        </div>

        <!-- Form -->
        <div class="p-6 space-y-4">
          <!-- Name -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              v-model="name"
              type="text"
              placeholder="e.g. Emergency fund"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              @keydown.enter="save"
            />
          </div>

          <!-- Target amount -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Target Amount
            </label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                {{ getCurrencySymbol() }}
              </span>
              <input
                v-model.number="targetAmount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                class="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                @keydown.enter="save"
              />
            </div>
          </div>

          <!-- Target date (optional) -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Target Date <span class="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
            </label>
            <input
              v-model="targetDate"
              type="date"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <!-- Tracking mode -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              How to track progress
            </label>
            <select
              v-model.number="accountId"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option :value="null">
                Track manually
              </option>
              <optgroup
                v-if="liquidAccounts.length > 0"
                label="Follow a cash account"
              >
                <option
                  v-for="acc in liquidAccounts"
                  :key="acc.id"
                  :value="acc.id"
                >
                  {{ acc.accountName }}
                </option>
              </optgroup>
            </select>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {{ isLinked
                ? "Progress follows this account's balance automatically."
                : "You'll log contributions yourself with the Add Funds button." }}
            </p>
          </div>

          <!-- Current amount (manual only) -->
          <div v-if="!isLinked">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Saved So Far
            </label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                {{ getCurrencySymbol() }}
              </span>
              <input
                v-model.number="currentAmount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                class="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                @keydown.enter="save"
              />
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div
          class="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0"
        >
          <button
            v-if="isEdit"
            class="px-4 py-2 text-expense hover:bg-expense/10 rounded-lg transition-colors"
            @click="emit('remove')"
          >
            Delete
          </button>
          <span v-else />

          <div class="flex space-x-3">
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
              {{ isEdit ? "Update" : "Create" }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
