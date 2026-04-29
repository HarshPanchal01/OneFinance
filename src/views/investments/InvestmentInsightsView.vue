<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useFinanceStore } from '@/stores/finance';
import AssetAllocationChart from './components/charts/AssetAllocationChart.vue';
import PortfolioHistoryChart from './components/charts/PortfolioHistoryChart.vue';
import AmountDisplay from '@/components/AmountDisplay.vue';

const store = useFinanceStore();

onMounted(async () => {
  await store.fetchAccounts();
  await store.fetchAccountTypes();
  await store.fetchInvestmentHoldings();
  // Fetch history for the combined view
  // For now we don't have a way to fetch ALL history combined, but we can fetch for each account
  const investmentAccounts = store.accounts.filter(a => {
    const type = store.accountTypes.find(at => at.id === a.accountTypeId);
    return type?.classification === 'investment';
  });
  
  for (const acc of investmentAccounts) {
      await store.fetchInvestmentHistory(acc.id);
  }
});

const totalPortfolioValue = computed(() => {
  return store.investmentHoldings.reduce((sum, h) => sum + (h.quantity * (h.lastPrice || 0)), 0);
});

const totalCashInInvestments = computed(() => {
  const investmentAccounts = store.accounts.filter(a => {
    const type = store.accountTypes.find(at => at.id === a.accountTypeId);
    return type?.classification === 'investment';
  });
  
  const totalValue = investmentAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  const totalHoldings = store.investmentHoldings.reduce((sum, h) => sum + (h.quantity * (h.lastPrice || 0)), 0);
  
  return totalValue - totalHoldings;
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <header class="mb-6 shrink-0">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        Investment Performance
      </h1>
      <p class="text-gray-500 dark:text-gray-400">
        Track your portfolio performance and asset allocation.
      </p>
    </header>

    <div class="flex-1 overflow-y-auto min-h-0 space-y-6 pb-6 pr-1">
      <!-- Top Metrics -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <p class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
            Holdings Value
          </p>
          <AmountDisplay
            :amount="totalPortfolioValue"
            class="text-3xl font-black text-gray-900 dark:text-white"
          />
        </div>
        <div class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <p class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
            Available Cash
          </p>
          <AmountDisplay
            :amount="totalCashInInvestments"
            class="text-3xl font-black text-gray-900 dark:text-white"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        <!-- Asset Allocation -->
        <div class="lg:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col min-h-[350px]">
          <h3 class="font-bold text-gray-900 dark:text-white mb-6 flex items-center shrink-0">
            <i class="pi pi-chart-pie mr-2 text-primary-500" />
            Asset Allocation
          </h3>
          <div class="flex-1 relative min-h-0">
            <AssetAllocationChart />
          </div>
        </div>

        <!-- Portfolio History -->
        <div class="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col min-h-[350px]">
          <h3 class="font-bold text-gray-900 dark:text-white mb-6 flex items-center shrink-0">
            <i class="pi pi-chart-line mr-2 text-primary-500" />
            Portfolio Value History
          </h3>
          <div class="flex-1 relative min-h-0">
            <PortfolioHistoryChart />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
