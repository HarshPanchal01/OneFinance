<script setup lang="ts">
import { computed } from "vue";
import { useFinanceStore } from "@/stores/finance";
import { useSettingsStore } from "@/stores/settings";
import AppChart from "@/components/AppChart.vue";
import type { CategoryBreakdown } from "@/types";
import { getDateRange, toIsoDateString } from "@/utils";
import { useFormatter } from "@/composables/useFormatter";

const props = defineProps<{
  breakdown: CategoryBreakdown[];
  timeRange: string;
  customRange?: { startDate: Date, endDate: Date };
}>();

const store = useFinanceStore();
const { formatCurrency } = useFormatter();
const settingsStore = useSettingsStore();

const totalExpenses = computed(() => {
  return props.breakdown.reduce((sum, item) => sum + item.total, 0);
});

const topCategories = computed(() => {
  // Top 10 categories + Others
  const all = [...props.breakdown].sort((a, b) => b.total - a.total);
  const top = all.slice(0, 10);
  const others = all.slice(10);

  const result = top.map((c) => ({
    ...c,
    percentage: totalExpenses.value > 0 ? (c.total / totalExpenses.value) * 100 : 0,
  }));

  if (others.length > 0) {
    const othersTotal = others.reduce((sum, c) => sum + c.total, 0);
    result.push({
      categoryId: null,
      categoryName: "Others",
      categoryColor: "#9ca3af",
      categoryIcon: "pi-ellipsis-h",
      total: othersTotal,
      count: others.reduce((sum, c) => sum + c.count, 0),
      percentage: totalExpenses.value > 0 ? (othersTotal / totalExpenses.value) * 100 : 0,
    });
  }

  return result;
});

const categoryData = computed(() => {
  return {
    labels: topCategories.value.map((c) => c.categoryName),
    datasets: [
      {
        data: topCategories.value.map((c) => c.total),
        backgroundColor: topCategories.value.map((c) => c.categoryColor), // Solid default
        hoverBackgroundColor: topCategories.value.map((c) => c.categoryColor + '99'), // Transparent hover
        borderColor: topCategories.value.map((c) => c.categoryColor),
        hoverBorderColor: topCategories.value.map((c) => c.categoryColor),
        borderWidth: 2,
        hoverOffset: 4,
      },
    ],
  };
});

const categoryOptions = computed(() => ({
  plugins: {
    legend: { display: false },
  },
  onHover: (_event: any, chartElement: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (_event as any).native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
  },
  onClick: (_event: any, elements: any[]) => {
    if (elements && elements.length > 0) {
      const index = elements[0].index;
      const category = topCategories.value[index];
      
      if (category.categoryId) {
        const { startDate, endDate } = getDateRange(props.timeRange, store.transactions, props.customRange);
        
        const filter = {
          categoryIds: [category.categoryId],
          fromDate: toIsoDateString(startDate),
          toDate: toIsoDateString(endDate),
          type: 'expense' as const
        };

        store.setTransactionFilter(filter);
        store.searchTransactions(filter);
      }
    }
  }
}));
</script>

<template>
  <div class="flex flex-col xl:flex-row h-full w-full items-start xl:justify-between gap-6">
    <!-- Left Column: Total Text + Chart -->
    <div class="flex flex-col items-center justify-start gap-0 shrink-0 w-full xl:w-auto">
      <h3 class="font-semibold text-gray-700 dark:text-gray-200 text-sm lg:text-base mb-1 lg:self-start xl:self-center whitespace-nowrap">
        <span class="lg:hidden xl:inline">Expense Breakdown</span>
        <span class="hidden lg:inline xl:hidden">Expenses</span>
      </h3>

      <!-- Total Text (Above Chart) -->
      <div class="flex flex-col items-center justify-center mb-1">
        <span class="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase leading-tight">Total</span>
        <span
          class="text-xl xl:text-2xl font-bold text-gray-800 dark:text-white"
          :class="{ 'privacy-blur': settingsStore.privacyMode }"
        >{{ formatCurrency(totalExpenses) }}</span>
      </div>

      <!-- Chart -->
      <div class="w-44 h-44 xl:w-56 xl:h-56">
        <AppChart
          type="pie"
          :data="categoryData"
          :options="categoryOptions"
          height="100%"
        />
      </div>
    </div>

    <!-- Custom Legend (Right Side - Hidden on small screens) -->
    <div class="hidden xl:flex overflow-y-auto h-full pr-2 space-y-3 pt-10 pb-2 flex-col">
      <div
        v-for="cat in topCategories"
        :key="cat.categoryId ?? 'others'"
        class="flex items-center gap-3"
      >
        <div
          class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          :style="{ backgroundColor: cat.categoryColor + '20' }"
        >
          <i
            :class="['pi', cat.categoryIcon]"
            :style="{ color: cat.categoryColor, fontSize: '12px' }"
          />
        </div>
        <div class="flex flex-col min-w-0">
          <span class="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate">
            {{ cat.categoryName }}
          </span>
          <span class="text-[11px] text-gray-400 font-medium">
            {{ cat.percentage.toFixed(1) }}%
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
