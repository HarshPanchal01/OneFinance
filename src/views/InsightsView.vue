<script setup lang="ts">
import { computed, onMounted, watch, ref } from "vue";
import { useFinanceStore } from "@/stores/finance";
import { formatCurrency, getMetricsForRange, getTimeRangeLabel } from "@/utils";
import type { DailyTransactionSum } from "@/types";
import CashFlowChart from "@/components/charts/CashFlowChart.vue";
import PacingChart from "@/components/charts/PacingChart.vue";
import ExpenseBreakdownChart from "@/components/charts/ExpenseBreakdownChart.vue";

const store = useFinanceStore();

// ===============================================
// DATA FETCHING
// ===============================================

onMounted(async () => {
  // Ensure trends are loaded matching the default 'YTD'
  await store.fetchRollingMonthlyTrends();

  if (store.expenseBreakdown.length === 0) {
    store.fetchPeriodSummarySync();
  }
  await refreshPacing();
});

// ===============================================
// METRICS
// ===============================================

const savingsTimeRange = ref<string>('thisMonth');
const avgSpendTimeRange = ref<string>('thisMonth');
const netCashFlowTimeRange = ref<string>('thisMonth');
const cashFlowOption = ref<string>('YTD');

// Watcher for cashFlowOption
watch(cashFlowOption, async (newVal) => {
    if (newVal === 'YTD') {
        await store.fetchRollingMonthlyTrends();
    } else {
        await store.fetchMonthlyTrends(parseInt(newVal));
    }
});

const savingsData = computed(() => getMetricsForRange(savingsTimeRange.value, store.transactions));
const avgSpendData = computed(() => getMetricsForRange(avgSpendTimeRange.value, store.transactions));
const netCashFlowData = computed(() => getMetricsForRange(netCashFlowTimeRange.value, store.transactions));

const savingsRate = computed(() => {
  const { income, expense } = savingsData.value;
  if (income === 0) return 0;
  return ((income - expense) / income) * 100;
});

const avgDailySpend = computed(() => {
  const { expense, days } = avgSpendData.value;
  if (days === 0) return 0;
  return expense / days;
});

const netCashFlow = computed(() => {
    const { income, expense } = netCashFlowData.value;
    return income - expense;
});

// ===============================================
// PACING CHART
// ===============================================

// Generate last 12 months for Dropdown A
const availableMonths = computed(() => {
    const months = [];
    const date = new Date();
    // Start from current month
    date.setDate(1); 
    
    for (let i = 0; i <= 12; i++) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // 1-12
        const value = `${year}-${String(month).padStart(2, '0')}`;
        const label = date.toLocaleString('default', { month: 'long', year: 'numeric' });
        months.push({ label, value });
        
        // Go back one month
        date.setMonth(date.getMonth() - 1);
    }
    return months;
});

const pacingRangeA = ref<string>(availableMonths.value[0]?.value || ''); // Default to current month
const pacingRangeB = ref<'lastMonth' | 'avg3Months' | 'avg6Months'>('lastMonth');
const pacingSeriesA = ref<DailyTransactionSum[]>([]);
const pacingSeriesB = ref<DailyTransactionSum[]>([]);

// Initialize default if availableMonths changes (e.g. on mount if empty initially, though computed runs immediately)
watch(availableMonths, (newVal) => {
    if (newVal.length > 0 && !pacingRangeA.value) {
        pacingRangeA.value = newVal[0].value;
    }
}, { immediate: true });

async function refreshPacing() {
    if (!pacingRangeA.value) return;
    
    const { seriesA, seriesB } = await store.fetchPacingData(pacingRangeA.value, pacingRangeB.value);
    pacingSeriesA.value = seriesA;
    pacingSeriesB.value = seriesB;
}

watch([pacingRangeA, pacingRangeB], refreshPacing);

// Helper for label display
const pacingLabelA = computed(() => {
    const m = availableMonths.value.find(m => m.value === pacingRangeA.value);
    return m ? m.label : 'Selected Month';
});

const pacingLabelB = computed(() => {
    switch(pacingRangeB.value) {
        case 'lastMonth': return 'Last Month Total';
        case 'avg3Months': return '3-Month Avg Total';
        case 'avg6Months': return '6-Month Avg Total';
        default: return 'Comparison';
    }
});
</script>

<template>
  <div class="space-y-6 pb-6">
    <div class="flex justify-between items-center">
      <h1 class="text-2xl font-bold text-gray-800 dark:text-white">
        Insights
      </h1>
    </div>

    <!-- Metrics Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- Savings Rate -->
      <div
        class="card p-4 flex flex-col justify-between border-l-4"
        :class="savingsRate >= 20 ? 'border-success' : (savingsRate > 0 ? 'border-warning' : 'border-expense')"
      >
        <div class="flex justify-between items-start">
            <div class="text-gray-500 text-sm font-medium uppercase">
              Savings Rate
            </div>
            <!-- Dropdown -->
            <select 
                v-model="savingsTimeRange"
                class="text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none cursor-pointer"
            >
                <option value="thisMonth">This Month</option>
                <option value="last3Months">Last 3 Months</option>
                <option value="last6Months">Last 6 Months</option>
                <option value="lastYear">Last Year</option>
                <option value="allTime">All Time</option>
            </select>
        </div>
        <div class="text-3xl font-bold mt-2 text-gray-800 dark:text-white">
          {{ savingsRate.toFixed(1) }}%
        </div>
        <div class="text-xs text-gray-400 mt-1">
          Target: >20%
        </div>
      </div>

      <!-- Avg Daily Spend -->
      <div class="card p-4 flex flex-col justify-between border-l-4 border-primary-500">
        <div class="flex justify-between items-start">
            <div class="text-gray-500 text-sm font-medium uppercase">
              Avg Daily Spend
            </div>
            <!-- Dropdown -->
            <select 
                v-model="avgSpendTimeRange"
                class="text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none cursor-pointer"
            >
                <option value="thisMonth">This Month</option>
                <option value="last3Months">Last 3 Months</option>
                <option value="last6Months">Last 6 Months</option>
                <option value="lastYear">Last Year</option>
                <option value="allTime">All Time</option>
            </select>
        </div>
        <div class="text-3xl font-bold mt-2 text-gray-800 dark:text-white">
          {{ formatCurrency(avgDailySpend) }}
        </div>
        <div class="text-xs text-gray-400 mt-1">
          Based on {{ getTimeRangeLabel(avgSpendTimeRange) }}
        </div>
      </div>

      <!-- Net Cash Flow -->
      <div
        class="card p-4 flex flex-col justify-between border-l-4"
        :class="netCashFlow >= 0 ? 'border-success' : 'border-expense'"
      >
        <div class="flex justify-between items-start">
            <div class="text-gray-500 text-sm font-medium uppercase">
              Net Cash Flow
            </div>
            <!-- Dropdown -->
            <select 
                v-model="netCashFlowTimeRange"
                class="text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none cursor-pointer"
            >
                <option value="thisMonth">This Month</option>
                <option value="last3Months">Last 3 Months</option>
                <option value="last6Months">Last 6 Months</option>
                <option value="lastYear">Last Year</option>
                <option value="allTime">All Time</option>
            </select>
        </div>
        <div
          class="text-3xl font-bold mt-2"
          :class="netCashFlow >= 0 ? 'text-success' : 'text-expense'"
        >
          {{ formatCurrency(netCashFlow) }}
        </div>
        <div class="text-xs text-gray-400 mt-1">
          Based on {{ getTimeRangeLabel(netCashFlowTimeRange) }}
        </div>
      </div>
    </div>

    <!-- Charts Row 1 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Cash Flow -->
      <div class="card p-4">
        <div class="flex justify-between items-center mb-4">
            <h3 class="font-semibold text-gray-700 dark:text-gray-200">
              Cash Flow
            </h3>
            <select 
                v-model="cashFlowOption"
                class="text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none cursor-pointer"
            >
                <option value="YTD">YTD</option>
                <option v-for="year in store.ledgerYears" :key="year" :value="year.toString()">
                    {{ year }}
                </option>
            </select>
        </div>
        <div class="h-64">
          <CashFlowChart />
        </div>
      </div>

      <!-- Spending Pacing -->
      <div class="card p-4">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
            <h3 class="font-semibold text-gray-700 dark:text-gray-200">
              Spending Pacing
            </h3>
            
            <!-- Custom Legend / Dropdowns -->
            <div class="flex flex-wrap items-center gap-4">
                <!-- Dropdown A (Blue) -->
                <div class="flex items-center">
                    <div class="w-3 h-3 bg-blue-500 mr-2 rounded-sm"></div>
                    <select 
                        v-model="pacingRangeA"
                        class="text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none cursor-pointer"
                    >
                        <option v-for="m in availableMonths" :key="m.value" :value="m.value">
                            {{ m.label }}
                        </option>
                    </select>
                </div>
                <!-- Dropdown B (Gray Dotted) -->
                <div class="flex items-center">
                    <div class="w-3 h-3 bg-gray-400 mr-2 rounded-sm border border-gray-600 border-dashed"></div>
                    <select 
                        v-model="pacingRangeB"
                        class="text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none cursor-pointer"
                    >
                        <option value="lastMonth">Last Month</option>
                        <option value="avg3Months">3 Month Avg</option>
                        <option value="avg6Months">6 Month Avg</option>
                    </select>
                </div>
            </div>
        </div>
        <div class="h-64">
          <PacingChart 
            :series-a="pacingSeriesA" 
            :series-b="pacingSeriesB" 
            :label-a="pacingLabelA" 
            :label-b="pacingLabelB"
          />
        </div>
      </div>
    </div>

    <!-- Charts Row 2 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Expense Breakdown -->
      <div class="card p-4">
        <h3 class="font-semibold text-gray-700 dark:text-gray-200 mb-4">
          Expense Breakdown
        </h3>
        <div class="h-64 flex justify-center">
          <ExpenseBreakdownChart />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
    @apply bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700;
}
</style>