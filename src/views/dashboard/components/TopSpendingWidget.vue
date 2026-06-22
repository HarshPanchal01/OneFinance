<script setup lang="ts">
import { computed } from "vue";
import { useFinanceStore } from "@/stores/finance";
import { useSettingsStore } from "@/stores/settings";
import { useFormatter } from "@/composables/useFormatter";
import { getExpenseBreakdownForRange, getCustomRangeObj, getDateRange, toIsoDateString } from "@/utils";
import type { SearchOptions } from "@/types";

const emit = defineEmits<{
  (e: "navigate-transactions"): void;
}>();

const store = useFinanceStore();
const settingsStore = useSettingsStore();
const { formatCurrency } = useFormatter();

// Open Transactions filtered to the selected period's expenses (optionally a
// single category) so the user can see the transactions behind the spend.
function openTransactions(categoryId?: number | null) {
  const { startDate, endDate } = getDateRange(
    store.dashboardRange,
    store.dashboardTransactions,
    getCustomRangeObj(store.dashboardCustomRange)
  );
  const filter: SearchOptions = {
    fromDate: toIsoDateString(startDate),
    toDate: toIsoDateString(endDate),
    type: "expense",
  };
  if (categoryId != null) filter.categoryIds = [categoryId];
  store.setTransactionFilter(filter);
  store.searchTransactions(filter);
  // Navigate explicitly — relying on the isSearching watcher alone misses the case
  // where a search is already active (it wouldn't change, so no navigation fires).
  emit("navigate-transactions");
}

const breakdown = computed(() =>
  getExpenseBreakdownForRange(
    store.dashboardRange,
    store.dashboardTransactions,
    getCustomRangeObj(store.dashboardCustomRange)
  )
);

const total = computed(() => breakdown.value.reduce((sum, c) => sum + c.total, 0));

// getExpenseBreakdownForRange already returns categories sorted by spend.
const top = computed(() =>
  breakdown.value.slice(0, 6).map((c) => ({
    ...c,
    pct: total.value > 0 ? (c.total / total.value) * 100 : 0,
  }))
);
</script>

<template>
  <div class="card p-5 flex flex-col h-full">
    <div class="flex items-center justify-between mb-4 shrink-0">
      <h2 class="text-base font-semibold text-gray-900 dark:text-white">
        Top Spending
      </h2>
      <button
        class="btn-view-all"
        @click="openTransactions()"
      >
        View all
      </button>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto -mr-3 pr-3">
      <div
        v-if="top.length === 0"
        class="h-full flex flex-col items-center justify-center py-6 text-gray-500 dark:text-gray-400"
      >
        <i class="pi pi-chart-pie text-3xl text-gray-300 dark:text-gray-600 mb-2" />
        <p class="text-sm">
          No spending in this period
        </p>
      </div>

      <ul
        v-else
        class="space-y-3"
      >
        <li
          v-for="cat in top"
          :key="cat.categoryId ?? 'uncategorized'"
          class="space-y-1.5"
          :class="cat.categoryId != null ? 'cursor-pointer hover:opacity-70 transition-opacity' : ''"
          @click="cat.categoryId != null && openTransactions(cat.categoryId)"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="inline-flex items-center gap-2 min-w-0">
              <span
                class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                :style="{ backgroundColor: cat.categoryColor + '20' }"
              >
                <i
                  :class="['pi', cat.categoryIcon]"
                  :style="{ color: cat.categoryColor, fontSize: '12px' }"
                />
              </span>
              <span class="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                {{ cat.categoryName }}
              </span>
            </span>
            <span
              class="text-sm font-semibold text-gray-900 dark:text-white shrink-0"
              :class="{ 'privacy-blur': settingsStore.privacyMode }"
            >
              {{ formatCurrency(cat.total) }}
            </span>
          </div>
          <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            <div
              class="h-1.5 rounded-full"
              :style="{ width: Math.min(100, cat.pct) + '%', backgroundColor: cat.categoryColor }"
            />
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
