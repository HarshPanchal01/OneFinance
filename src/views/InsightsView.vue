<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { useFinanceStore } from "@/stores/finance";
import { formatCurrency } from "@/utils";
import CashFlowChart from "@/components/charts/CashFlowChart.vue";
import PacingChart from "@/components/charts/PacingChart.vue";
import ExpenseBreakdownChart from "@/components/charts/ExpenseBreakdownChart.vue";

const store = useFinanceStore();

// ===============================================
// DATA FETCHING
// ===============================================

onMounted(async () => {
  // Ensure we have the necessary data
  if (store.monthlyTrends.length === 0) {
    const year = store.currentLedgerMonth?.year || store.selectedYear || new Date().getFullYear();
    await store.fetchMonthlyTrends(year);
  }
  if (store.expenseBreakdown.length === 0) {
    store.fetchPeriodSummarySync();
  }
  await store.fetchPacingTrends();
});

// Watch for period changes to refresh data
watch(() => store.currentLedgerMonth, async () => {
    await store.fetchPacingTrends();
});

// ===============================================
// METRICS
// ===============================================

const savingsRate = computed(() => {
  const income = store.periodSummary.totalIncome;
  const expenses = store.periodSummary.totalExpenses;
  if (income === 0) return 0;
  return ((income - expenses) / income) * 100;
});

const avgDailySpend = computed(() => {
  const expenses = store.periodSummary.totalExpenses;
  
  // Calculate days elapsed
  const now = new Date();
  let daysElapsed = 1;
  
  if (store.currentLedgerMonth) {
    const year = store.currentLedgerMonth.year;
    const month = store.currentLedgerMonth.month;
    
    // If it's the current real-world month
    if (year === now.getFullYear() && month === now.getMonth() + 1) {
      daysElapsed = now.getDate();
    } else {
      // Full month
      daysElapsed = new Date(year, month, 0).getDate();
    }
  } else if (store.selectedYear) {
      // Selected Year - Average over 365 or days elapsed so far?
      if (store.selectedYear === now.getFullYear()){
          // Days from Jan 1 to Now
          const start = new Date(store.selectedYear, 0, 1);
          const diff = now.getTime() - start.getTime();
          daysElapsed = Math.ceil(diff / (1000 * 3600 * 24)); 
      } else {
          daysElapsed = 365; // Approximate
      }
  } else {
      return 0; 
  }

  if (daysElapsed === 0) return 0;
  return expenses / daysElapsed;
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
        <div class="text-gray-500 text-sm font-medium uppercase">
          Savings Rate
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
        <div class="text-gray-500 text-sm font-medium uppercase">
          Avg Daily Spend
        </div>
        <div class="text-3xl font-bold mt-2 text-gray-800 dark:text-white">
          {{ formatCurrency(avgDailySpend) }}
        </div>
        <div class="text-xs text-gray-400 mt-1">
          Based on elapsed days
        </div>
      </div>

      <!-- Net Cash Flow -->
      <div
        class="card p-4 flex flex-col justify-between border-l-4"
        :class="store.periodSummary.balance >= 0 ? 'border-success' : 'border-expense'"
      >
        <div class="text-gray-500 text-sm font-medium uppercase">
          Net Cash Flow
        </div>
        <div
          class="text-3xl font-bold mt-2"
          :class="store.periodSummary.balance >= 0 ? 'text-success' : 'text-expense'"
        >
          {{ formatCurrency(store.periodSummary.balance) }}
        </div>
        <div class="text-xs text-gray-400 mt-1">
          Income - Expenses
        </div>
      </div>
    </div>

    <!-- Charts Row 1 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Cash Flow -->
      <div class="card p-4">
        <h3 class="font-semibold text-gray-700 dark:text-gray-200 mb-4">
          Cash Flow
        </h3>
        <div class="h-64">
          <CashFlowChart />
        </div>
      </div>

      <!-- Spending Pacing -->
      <div class="card p-4">
        <h3 class="font-semibold text-gray-700 dark:text-gray-200 mb-4">
          Spending Pacing
        </h3>
        <div class="h-64">
          <PacingChart />
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