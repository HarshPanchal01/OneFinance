<script setup lang="ts">
import { computed, onMounted, watch, ref } from "vue";
import { useFinanceStore } from "@/stores/finance";
import {
  getMetricsForRange,
  getTimeRangeLabel,
  getExpenseBreakdownForRange,
  getCustomRangeObj,
  calculateSavingsRate,
  calculateAvgDailySpend,
  calculateNetCashFlow } from "@/utils";
import { useFormatter } from "@/composables/useFormatter";
import CashFlowChart from "@/views/insights/components/charts/CashFlowChart.vue";
import ExpenseBreakdownChart from "@/views/insights/components/charts/ExpenseBreakdownChart.vue";
import NetWorthChart from "@/views/insights/components/charts/NetWorthChart.vue";
import SpendingHeatmapChart from "@/views/insights/components/charts/SpendingHeatmapChart.vue";
import InsightMetricCard from "@/views/insights/components/InsightMetricCard.vue";
import InsightTimeRangeSelector from "@/views/insights/components/InsightTimeRangeSelector.vue";

const store = useFinanceStore();
const { formatCurrency } = useFormatter();

// ===============================================
// DATA FETCHING
// ===============================================

onMounted(async () => {
  // Ensure trends are loaded matching the default 'YTD'
  await store.fetchRollingMonthlyTrends();
  await store.fetchNetWorthTrend();

  if (store.expenseBreakdown.length === 0) {
    store.fetchPeriodSummarySync();
  }
  // The heatmap aggregates the unscoped dashboardTransactions (store.transactions
  // can be month/year-scoped by the sidebar); make sure it's loaded (Budgets-view pattern).
  if (store.dashboardTransactions.length === 0) {
    await store.refreshDashboardData();
  }
});

// ===============================================
// METRICS
// ===============================================

const savingsTimeRange = ref<string>('thisMonth');
const avgSpendTimeRange = ref<string>('thisMonth');
const netCashFlowTimeRange = ref<string>('thisMonth');
const expenseBreakdownTimeRange = ref<string>('thisMonth');
const cashFlowOption = ref<string>('YTD');
const netWorthOption = ref<string>('YTD');

// Custom Date Ranges (Actual used for metrics)
 
const savingsCustomDate = ref<any>(null);
 
const avgSpendCustomDate = ref<any>(null);
 
const netCashFlowCustomDate = ref<any>(null);
 
const expenseBreakdownCustomDate = ref<any>(null);

// Watcher for cashFlowOption
watch(cashFlowOption, async (newVal) => {
    if (newVal === 'YTD') {
        await store.fetchRollingMonthlyTrends();
    } else {
        await store.fetchMonthlyTrends(parseInt(newVal));
    }
});

const savingsData = computed(() => getMetricsForRange(savingsTimeRange.value, store.transactions, getCustomRangeObj(savingsCustomDate.value)));
const avgSpendData = computed(() => getMetricsForRange(avgSpendTimeRange.value, store.transactions, getCustomRangeObj(avgSpendCustomDate.value)));
const netCashFlowData = computed(() => getMetricsForRange(netCashFlowTimeRange.value, store.transactions, getCustomRangeObj(netCashFlowCustomDate.value)));
const expenseBreakdownData = computed(() => getExpenseBreakdownForRange(expenseBreakdownTimeRange.value, store.transactions, getCustomRangeObj(expenseBreakdownCustomDate.value)));

const savingsRate = computed(() => {
  const { income, expense } = savingsData.value;
  return calculateSavingsRate(income, expense);
});

const avgDailySpend = computed(() => {
  const { expense, days } = avgSpendData.value;
  return calculateAvgDailySpend(expense, days);
});

const netCashFlow = computed(() => {
    const { income, expense } = netCashFlowData.value;
    return calculateNetCashFlow(income, expense);
});

// ===============================================
// AVAILABLE YEARS (Ledger + Transaction History)
// ===============================================

const availableYears = computed(() => {
    const years = new Set(store.ledgerYears);
    
    store.netWorthTrends.forEach(trend => {
        years.add(trend.year);
    });
    
    return Array.from(years).sort((a, b) => b - a);
});
</script>

<template>
  <div class="flex flex-col gap-4 pb-4 max-w-full overflow-x-hidden overflow-y-auto h-full pr-2">
    <header class="flex items-center justify-between shrink-0">
      <div>
        <div class="flex items-center space-x-3">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            General Insights
          </h1>
        </div>
        <p class="text-gray-500 dark:text-gray-400 mt-1">
          Analyze your spending trends and cash flow.
        </p>
      </div>
    </header>

    <!-- Metrics Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- Savings Rate -->
      <InsightMetricCard
        v-model:model-value="savingsTimeRange"
        v-model:custom-range="savingsCustomDate"
        title="Savings Rate"
        :value="savingsRate.toFixed(1) + '%'"
        :value-class="savingsRate > 0 ? 'text-income' : 'text-expense'"
        :border-class="savingsRate > 0 ? 'border-income' : 'border-expense'"
        formula-title="Savings Rate Formula"
        formula="(Income - Expenses) / Income"
        :calculation="`(${formatCurrency(savingsData.income)} - ${formatCurrency(savingsData.expense)}) / ${formatCurrency(savingsData.income)}`"
      >
        <template #footer>
          <div class="text-xs text-gray-400 mt-1">
            Based on {{ getTimeRangeLabel(savingsTimeRange, getCustomRangeObj(savingsCustomDate)) }}
          </div>
        </template>
      </InsightMetricCard>

      <!-- Avg Daily Spend -->
      <InsightMetricCard
        v-model:model-value="avgSpendTimeRange"
        v-model:custom-range="avgSpendCustomDate"
        title="Average Daily Spend"
        :value="formatCurrency(avgDailySpend)"
        value-class="text-gray-800 dark:text-white"
        border-class="border-primary-500"
        formula-title="Average Daily Spend"
        formula="Total Expenses / Days in Period"
        :calculation="`${formatCurrency(avgSpendData.expense)} / ${avgSpendData.days} days`"
      >
        <template #footer>
          <div class="text-xs text-gray-400 mt-1">
            Based on {{ getTimeRangeLabel(avgSpendTimeRange, getCustomRangeObj(avgSpendCustomDate)) }}
          </div>
        </template>
      </InsightMetricCard>

      <!-- Net Cash Flow -->
      <InsightMetricCard
        v-model:model-value="netCashFlowTimeRange"
        v-model:custom-range="netCashFlowCustomDate"
        class="md:col-span-2 lg:col-span-1"
        title="Net Cash Flow"
        :value="formatCurrency(netCashFlow)"
        :value-class="netCashFlow >= 0 ? 'text-income' : 'text-expense'"
        :border-class="netCashFlow >= 0 ? 'border-income' : 'border-expense'"
        formula-title="Net Cash Flow"
        formula="Total Income - Total Expenses"
        :calculation="`${formatCurrency(netCashFlowData.income)} - ${formatCurrency(netCashFlowData.expense)}`"
      >
        <template #footer>
          <div class="text-xs text-gray-400 mt-1">
            Based on {{ getTimeRangeLabel(netCashFlowTimeRange, getCustomRangeObj(netCashFlowCustomDate)) }}
          </div>
        </template>
      </InsightMetricCard>
    </div>

    <!-- Charts Row 1 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- Cash Flow -->
      <div class="card p-4">
        <div class="relative flex items-center justify-end mb-4 min-h-[32px]">
          <!-- Custom Legend (Left) -->
          <div class="hidden xl:flex flex-row gap-4 absolute left-0">
            <div class="flex items-center gap-1.5">
              <div class="w-2.5 h-1.5 rounded-sm bg-income shrink-0" />
              <span class="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Income</span>
            </div>
            <div class="flex items-center gap-1.5">
              <div class="w-2.5 h-1.5 rounded-sm bg-expense shrink-0" />
              <span class="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Expenses</span>
            </div>
          </div>

          <h3 class="xl:absolute xl:left-1/2 xl:-translate-x-1/2 font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap text-sm lg:text-base flex-1 xl:flex-none text-center">
            Cash Flow
          </h3>

          <div class="z-10">
            <select
              v-model="cashFlowOption"
              class="text-[10px] lg:text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none cursor-pointer"
            >
              <option value="YTD">
                YTD
              </option>
              <option
                v-for="year in availableYears"
                :key="year"
                :value="year.toString()"
              >
                {{ year }}
              </option>
            </select>
          </div>
        </div>
        <div class="h-64">
          <CashFlowChart />
        </div>
      </div>

      <!-- Net Worth Trend -->
      <div class="card p-4 flex flex-col">
        <div class="relative flex items-center justify-end mb-4 min-h-[32px]">
          <h3 class="xl:absolute xl:left-1/2 xl:-translate-x-1/2 font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap text-sm lg:text-base flex-1 xl:flex-none text-center">
            Net Worth Trend
          </h3>
          <div class="z-10">
            <select
              v-model="netWorthOption"
              class="text-[10px] lg:text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none cursor-pointer"
            >
              <option value="YTD">
                YTD
              </option>
              <option
                v-for="year in availableYears"
                :key="year"
                :value="year.toString()"
              >
                {{ year }}
              </option>
            </select>
          </div>
        </div>
        <div class="h-64">
          <NetWorthChart :option="netWorthOption" />
        </div>
      </div>
    </div>

    <!-- Charts Row 2 (fills the remaining viewport height on lg+). The breakdown
         card needs 3/7 below ~1792px: narrower can't hold the fixed 256px pie +
         legend at the 1280px minimum window without clipping. -->
    <div class="grid grid-cols-1 lg:grid-cols-7 gap-4 lg:flex-1 min-h-0">
      <!-- Expense Breakdown -->
      <div class="card p-4 lg:col-span-3 min-[1792px]:col-span-2 flex flex-col relative min-h-0">
        <div class="absolute top-4 right-4 z-20">
          <InsightTimeRangeSelector
            v-model:model-value="expenseBreakdownTimeRange"
            v-model:custom-range="expenseBreakdownCustomDate"
          />
        </div>
        <div class="flex-1">
          <ExpenseBreakdownChart
            :breakdown="expenseBreakdownData"
            :time-range="expenseBreakdownTimeRange"
            :custom-range="getCustomRangeObj(expenseBreakdownCustomDate)"
          />
        </div>
        <div class="text-xs text-gray-400 mt-auto pt-4 pl-1">
          Based on {{ getTimeRangeLabel(expenseBreakdownTimeRange, getCustomRangeObj(expenseBreakdownCustomDate)) }}
        </div>
      </div>

      <!-- Spending Calendar Heatmap -->
      <div class="card p-4 lg:col-span-4 min-[1792px]:col-span-5 flex flex-col min-h-0">
        <SpendingHeatmapChart />
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
    @apply bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700;
}
</style>