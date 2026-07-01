<script setup lang="ts">
import { computed } from "vue";
import { useFinanceStore } from "@/stores/finance";
import { useSettingsStore } from "@/stores/settings";
import { useFormatter } from "@/composables/useFormatter";
import { getExpenseBreakdownForRange, getDateRange, toIsoDateString } from "@/utils";
import type { SearchOptions } from "@/types";

const emit = defineEmits<{
  (e: "navigate-transactions"): void;
  (e: "open-budgets"): void;
}>();

const store = useFinanceStore();
const settingsStore = useSettingsStore();
const { formatCurrency } = useFormatter();

// Always the current month (independent of the dashboard period selector) so
// spend stays comparable to the monthly budgets shown alongside it.
function openTransactions(categoryId?: number | null) {
  const { startDate, endDate } = getDateRange("thisMonth");
  const filter: SearchOptions = {
    fromDate: toIsoDateString(startDate),
    toDate: toIsoDateString(endDate),
    type: "expense",
  };
  if (categoryId != null) filter.categoryIds = [categoryId];
  store.setTransactionFilter(filter);
  store.searchTransactions(filter);
  emit("navigate-transactions");
}

const breakdown = computed(() =>
  getExpenseBreakdownForRange("thisMonth", store.dashboardTransactions)
);
const spendTotal = computed(() => breakdown.value.reduce((sum, c) => sum + c.total, 0));

// Unified rows: top categories by spend, each annotated with its budget (if set)
// so a single list shows both "where money went" and "vs my limit".
const rows = computed(() =>
  breakdown.value.slice(0, 6).map((c) => {
    const budget = c.categoryId != null
      ? store.budgets.find((b) => b.categoryId === c.categoryId)
      : undefined;
    const limit = budget?.amount ?? null;
    return {
      categoryId: c.categoryId,
      name: c.categoryName,
      color: c.categoryColor,
      icon: c.categoryIcon,
      total: c.total,
      limit,
      over: limit != null && c.total > limit,
      // Budgeted rows fill against their limit; the rest against the top spender's share.
      pct: limit != null
        ? (limit > 0 ? (c.total / limit) * 100 : 0)
        : (spendTotal.value > 0 ? (c.total / spendTotal.value) * 100 : 0),
    };
  })
);
</script>

<template>
  <div class="card p-5 flex flex-col h-full">
    <div class="flex items-center justify-between mb-4 shrink-0 gap-2">
      <h2 class="text-base font-semibold text-gray-900 dark:text-white">
        Spending
        <span class="text-xs font-normal text-gray-400 dark:text-gray-500">· This month</span>
      </h2>
      <div class="flex items-center gap-3 shrink-0">
        <button
          class="btn-view-all"
          title="Manage budgets"
          @click="emit('open-budgets')"
        >
          Budgets
        </button>
        <button
          class="btn-view-all"
          @click="openTransactions()"
        >
          View all
        </button>
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto -mr-3 pr-3">
      <div
        v-if="rows.length === 0"
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
          v-for="row in rows"
          :key="row.categoryId ?? 'uncategorized'"
          class="space-y-1.5"
          :class="row.categoryId != null ? 'cursor-pointer hover:opacity-70 transition-opacity' : ''"
          @click="row.categoryId != null && openTransactions(row.categoryId)"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="inline-flex items-center gap-2 min-w-0">
              <span
                class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                :style="{ backgroundColor: row.color + '20' }"
              >
                <i
                  :class="['pi', row.icon]"
                  :style="{ color: row.color, fontSize: '12px' }"
                />
              </span>
              <span class="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                {{ row.name }}
              </span>
            </span>
            <span
              class="text-sm font-semibold shrink-0"
              :class="row.over ? 'text-expense' : 'text-gray-900 dark:text-white'"
            >
              <span :class="{ 'privacy-blur': settingsStore.privacyMode }">{{ formatCurrency(row.total) }}</span>
              <span
                v-if="row.limit != null"
                class="text-xs font-normal text-gray-400 dark:text-gray-500"
              >/ {{ formatCurrency(row.limit) }}</span>
            </span>
          </div>
          <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            <div
              class="h-1.5 rounded-full"
              :class="{ 'opacity-40': row.limit == null }"
              :style="{
                width: Math.min(100, row.pct) + '%',
                backgroundColor: row.over ? '#ef4444' : row.color,
              }"
            />
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
