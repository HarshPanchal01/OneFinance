<script setup lang="ts">
import { computed } from "vue";
import { useFinanceStore } from "@/stores/finance";
import { useSettingsStore } from "@/stores/settings";
import { useFormatter } from "@/composables/useFormatter";
import { ACCOUNT_CLASSIFICATION_META } from "@/utils";
import type { AccountClassification } from "@/types";

const emit = defineEmits<{
  (e: "view-accounts"): void;
  (e: "edit-account", id: number): void;
}>();

const store = useFinanceStore();
const settingsStore = useSettingsStore();
const { formatCurrency } = useFormatter();

function classificationOf(accountTypeId: number): AccountClassification {
  return store.accountTypes.find((at) => at.id === accountTypeId)?.classification ?? "liquid";
}

// Only spendable / investable balances belong on the dashboard glance.
const sortedAccounts = computed(() =>
  [...store.accounts]
    .filter((a) => {
      const c = classificationOf(a.accountTypeId);
      return c === "liquid" || c === "investment";
    })
    .sort((a, b) => (b.balance || 0) - (a.balance || 0))
    .map((a) => {
      const classification = classificationOf(a.accountTypeId);
      return {
        id: a.id,
        name: a.accountName,
        classification,
        display: a.balance || 0,
      };
    })
);
</script>

<template>
  <div class="card p-5 flex flex-col h-full">
    <div class="flex items-center justify-between mb-4 shrink-0">
      <h2 class="text-base font-semibold text-gray-900 dark:text-white">
        Accounts
      </h2>
      <button
        class="btn-view-all"
        @click="emit('view-accounts')"
      >
        View all
      </button>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto -mr-3 pr-3">
      <div
        v-if="sortedAccounts.length === 0"
        class="h-full flex flex-col items-center justify-center py-6 text-gray-500 dark:text-gray-400"
      >
        <i class="pi pi-wallet text-3xl text-gray-300 dark:text-gray-600 mb-2" />
        <p class="text-sm">
          No accounts yet
        </p>
      </div>

      <ul
        v-else
        class="space-y-2"
      >
        <li
          v-for="acc in sortedAccounts"
          :key="acc.id"
          class="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          @click="emit('edit-account', acc.id)"
        >
          <div
            class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            :style="{ backgroundColor: ACCOUNT_CLASSIFICATION_META[acc.classification].color + '20' }"
          >
            <i
              :class="['pi', ACCOUNT_CLASSIFICATION_META[acc.classification].icon]"
              :style="{ color: ACCOUNT_CLASSIFICATION_META[acc.classification].color }"
            />
          </div>
          <span class="text-sm font-medium text-gray-800 dark:text-gray-100 truncate flex-1 min-w-0">
            {{ acc.name }}
          </span>
          <span
            class="text-sm font-semibold text-gray-900 dark:text-white shrink-0"
            :class="{ 'privacy-blur': settingsStore.privacyMode }"
          >
            {{ formatCurrency(acc.display) }}
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>
