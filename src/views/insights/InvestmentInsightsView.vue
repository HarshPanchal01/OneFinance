<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useFinanceStore } from '@/stores/finance';
import { useFormatter } from '@/composables/useFormatter';
import AssetAllocationChart from './components/charts/AssetAllocationChart.vue';
import PortfolioHistoryChart from './components/charts/PortfolioHistoryChart.vue';
import MarketVsBookList from './components/MarketVsBookList.vue';
import NetContributionsChart from './components/charts/NetContributionsChart.vue';
import InsightMetricCard from '@/views/insights/components/InsightMetricCard.vue';
import TradeHistoryModal from '@/views/investments/components/TradeHistoryModal.vue';
import { getDateRange, toIsoDateString, getCustomRangeObj, getTimeRangeLabel } from '@/utils';
import type { InvestmentTransaction } from '@/types';

const store = useFinanceStore();
const { formatCurrency } = useFormatter();

const showHistoryModal = ref(false);
const modalHistoryAccountId = ref<number | null>(null);
const historyInitialAssetFilter = ref<string | undefined>(undefined);

function handleOpenHistory(symbol: string, accountId: string) {
  historyInitialAssetFilter.value = symbol;
  modalHistoryAccountId.value = accountId === 'all' ? null : Number(accountId);
  showHistoryModal.value = true;
}

const globalHistory = ref<{ date: string, totalValue: number }[]>([]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalAdjustments = ref<any[]>([]);
const globalInvestmentTransactions = ref<InvestmentTransaction[]>([]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rawHistories = ref<any[]>([]);

async function fetchGlobalHistory() {
  const investmentAccounts = store.accounts.filter(a => {
    const type = store.accountTypes.find(at => at.id === a.accountTypeId);
    return type?.classification === 'investment';
  });
  
  const histories = [];
  for (const acc of investmentAccounts) {
      const h = await window.electronAPI.getInvestmentHistory(acc.id);
      histories.push(...h);
  }
  
  rawHistories.value = histories;

  // Group by date to compute global history safely
  const dateMap = new Map<string, number>();
  for (const h of histories) {
      dateMap.set(h.date, (dateMap.get(h.date) || 0) + h.totalValue);
  }
  
  globalHistory.value = Array.from(dateMap.entries())
    .map(([date, totalValue]) => ({ date, totalValue }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

onMounted(async () => {
  await store.fetchAccounts();
  await store.fetchAccountTypes();
  await store.fetchInvestmentHoldings();
  
  await fetchGlobalHistory();

  // Fetch adjustments for net contributions
  globalAdjustments.value = await window.electronAPI.getInvestmentAdjustments();
  // Fetch transactions for book value calculation
  globalInvestmentTransactions.value = await window.electronAPI.getAllInvestmentTransactions();
});

const isRefreshing = ref(false);

async function refreshPrices() {
  if (store.refreshCooldown > 0) return;
  isRefreshing.value = true;
  await store.refreshInvestmentPrices();
  await store.fetchAccounts(); // Refresh balances
  await fetchGlobalHistory();
  isRefreshing.value = false;
  store.startRefreshCooldown();
}

const totalPortfolioValue = computed(() => {
  const investmentAccounts = store.accounts.filter(a => {
    const type = store.accountTypes.find(at => at.id === a.accountTypeId);
    return type?.classification === 'investment';
  });
  return investmentAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);
});

// Helper to determine if an account is an investment account
const investmentAccountIds = computed(() => new Set(store.accounts.filter(a => {
  const type = store.accountTypes.find(at => at.id === a.accountTypeId);
  return type?.classification === 'investment';
}).map(a => a.id)));

const isInvestment = (id: number) => investmentAccountIds.value.has(id);

function getPortfolioValueAt(date: Date) {
    if (globalHistory.value.length === 0) return 0;
    const isoDate = toIsoDateString(date);
    let value = globalHistory.value[0].totalValue; // Fallback to first known value if before any history
    for (const h of globalHistory.value) {
        if (h.date <= isoDate) {
            value = h.totalValue;
        } else {
            break;
        }
    }
    return value;
}

function getNetContributions(startDate: Date, endDate: Date) {
    let net = 0;
    const startIso = toIsoDateString(startDate);
    const endIso = toIsoDateString(endDate);
    
    // Transactions
    for (const t of store.transactions) {
        if (t.date >= startIso && t.date <= endIso) {
            if (t.type === 'transfer' && t.transferAccountId) {
                const sourceInv = isInvestment(t.accountId);
                const destInv = isInvestment(t.transferAccountId);
                if (!sourceInv && destInv) net += t.amount;
                else if (sourceInv && !destInv) net -= t.amount;
            }
        }
    }
    
    // Adjustments
    for (const adj of globalAdjustments.value) {
        if (adj.date >= startIso && adj.date <= endIso) {
            if (adj.type === 'income') net += adj.amount;
            else if (adj.type === 'expense') net -= adj.amount;
        }
    }
    
    return net;
}

function handleHighlightAsset(symbol: string, accountId: string) {
  bookValueAccountId.value = accountId;
  highlightedSymbol.value = symbol;
  
  window.setTimeout(() => {
    highlightedSymbol.value = null;
  }, 2000);
}

// Chart Filters
const bookValueAccountId = ref<string>('all');
const allocationAccountId = ref<string>('all');
const contributionsAccountId = ref<string>('all');
const contributionsOption = ref<string>('YTD');
const historyAccountId = ref<string>('all');
const historyOption = ref<string>('YTD');

const highlightedSymbol = ref<string | null>(null);

// Helper for years
const availableYears = computed(() => {
    const years = new Set(store.ledgerYears);
    globalHistory.value.forEach(h => {
        years.add(parseInt(h.date.substring(0, 4)));
    });
    return Array.from(years).sort((a, b) => b - a);
});

const computedHistoryData = computed(() => {
    if (historyAccountId.value === 'all') {
        return globalHistory.value;
    }
    const accId = parseInt(historyAccountId.value);
    const dateMap = new Map<string, number>();
    for (const h of rawHistories.value.filter(x => x.accountId === accId)) {
        dateMap.set(h.date, (dateMap.get(h.date) || 0) + h.totalValue);
    }
    return Array.from(dateMap.entries())
        .map(([date, totalValue]) => ({ date, totalValue }))
        .sort((a, b) => a.date.localeCompare(b.date));
});

// Stats State
const returnTimeRange = ref<string>('thisMonth');
const netValueTimeRange = ref<string>('thisMonth');
const contributionsTimeRange = ref<string>('thisMonth');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const returnCustomDate = ref<any>(null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const netValueCustomDate = ref<any>(null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const contributionsCustomDate = ref<any>(null);

const returnData = computed(() => {
    const { startDate, endDate } = getDateRange(returnTimeRange.value, store.transactions, getCustomRangeObj(returnCustomDate.value));
    const endIso = toIsoDateString(endDate);
    const todayIso = toIsoDateString(new Date());
    
    const startVal = getPortfolioValueAt(startDate);
    const endVal = endIso >= todayIso ? totalPortfolioValue.value : getPortfolioValueAt(endDate);
    
    const change = endVal - startVal;
    const percent = startVal > 0 ? (change / startVal) * 100 : 0;
    
    return { startVal, endVal, change, percent };
});

const netValueData = computed(() => {
    const { startDate, endDate } = getDateRange(netValueTimeRange.value, store.transactions, getCustomRangeObj(netValueCustomDate.value));
    const endIso = toIsoDateString(endDate);
    const todayIso = toIsoDateString(new Date());
    
    const startVal = getPortfolioValueAt(startDate);
    const endVal = endIso >= todayIso ? totalPortfolioValue.value : getPortfolioValueAt(endDate);
    
    const change = endVal - startVal;
    return { startVal, endVal, change };
});

const contributionsData = computed(() => {
    const { startDate, endDate } = getDateRange(contributionsTimeRange.value, store.transactions, getCustomRangeObj(contributionsCustomDate.value));
    const net = getNetContributions(startDate, endDate);
    return { net };
});

</script>

<template>
  <div class="space-y-6 pb-6 max-w-full overflow-x-hidden overflow-y-auto h-full pr-2">
    <header class="flex items-center justify-between shrink-0">
      <div>
        <div class="flex items-center space-x-3">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            Portfolio Insights
          </h1>
        </div>
        <p class="text-gray-500 dark:text-gray-400 mt-1">
          Track your portfolio performance and asset allocation.
        </p>
      </div>
      <div class="flex items-center space-x-6">
        <button
          class="inline-flex items-center px-4 py-2 bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-900/60 font-medium rounded-lg transition-colors disabled:opacity-50"
          :disabled="isRefreshing || store.refreshCooldown > 0"
          @click="refreshPrices"
        >
          <i :class="['pi pi-refresh mr-2', { 'animate-spin': isRefreshing }]" />
          {{ store.refreshCooldown > 0 ? `Refresh (${store.refreshCooldown}s)` : 'Refresh Prices' }}
        </button>
      </div>
    </header>

    <!-- Metrics Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- Period Return -->
      <InsightMetricCard
        v-model:model-value="returnTimeRange"
        v-model:custom-range="returnCustomDate"
        title="Period Return"
        :value="(returnData.percent > 0 ? '+' : '') + returnData.percent.toFixed(2) + '%'"
        :value-class="returnData.percent >= 0 ? 'text-income' : 'text-expense'"
        :border-class="returnData.percent >= 0 ? 'border-income' : 'border-expense'"
        formula-title="Period Return"
        formula="(End Value - Start Value) / Start Value"
        :calculation="`(${formatCurrency(returnData.endVal)} - ${formatCurrency(returnData.startVal)}) / ${formatCurrency(returnData.startVal)}`"
      >
        <template #footer>
          <div class="text-xs text-gray-400 mt-1">
            Based on {{ getTimeRangeLabel(returnTimeRange, getCustomRangeObj(returnCustomDate)) }}
          </div>
        </template>
      </InsightMetricCard>

      <!-- Net Value Change -->
      <InsightMetricCard
        v-model:model-value="netValueTimeRange"
        v-model:custom-range="netValueCustomDate"
        title="Net Value Change"
        :value="(netValueData.change > 0 ? '+' : '') + formatCurrency(netValueData.change)"
        :value-class="netValueData.change >= 0 ? 'text-income' : 'text-expense'"
        :border-class="netValueData.change >= 0 ? 'border-income' : 'border-expense'"
        formula-title="Net Value Change"
        formula="End Value - Start Value"
        :calculation="`${formatCurrency(netValueData.endVal)} - ${formatCurrency(netValueData.startVal)}`"
      >
        <template #footer>
          <div class="text-xs text-gray-400 mt-1">
            Based on {{ getTimeRangeLabel(netValueTimeRange, getCustomRangeObj(netValueCustomDate)) }}
          </div>
        </template>
      </InsightMetricCard>

      <!-- Net Contributions -->
      <InsightMetricCard
        v-model:model-value="contributionsTimeRange"
        v-model:custom-range="contributionsCustomDate"
        title="Net Contributions"
        :value="(contributionsData.net > 0 ? '+' : '') + formatCurrency(contributionsData.net)"
        :value-class="contributionsData.net >= 0 ? 'text-income' : 'text-expense'"
        :border-class="contributionsData.net >= 0 ? 'border-income' : 'border-expense'"
        formula-title="Net Contributions"
        formula="Total Deposits - Total Withdrawals"
        :calculation="`${formatCurrency(contributionsData.net)} net cash movements`"
      >
        <template #footer>
          <div class="text-xs text-gray-400 mt-1">
            Based on {{ getTimeRangeLabel(contributionsTimeRange, getCustomRangeObj(contributionsCustomDate)) }}
          </div>
        </template>
      </InsightMetricCard>
    </div>

    <!-- Charts Row 1 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-6 mt-4">
      <!-- Market vs Book Value -->
      <div class="card p-4 lg:col-span-2 xl:col-span-3 flex flex-col h-[350px]">
        <div class="relative flex items-center justify-end mb-4 shrink-0 min-h-[32px]">
          <h3 class="absolute left-1/2 -translate-x-1/2 font-semibold text-gray-700 dark:text-gray-200 text-sm lg:text-base text-center whitespace-nowrap pointer-events-none">
            Book Value of Assets
          </h3>
          <div class="z-10 flex gap-2">
            <select
              v-model="bookValueAccountId"
              class="text-[10px] lg:text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1 focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer max-w-[120px] truncate"
            >
              <option value="all">
                Combined
              </option>
              <option
                v-for="acc in store.accounts.filter(a => isInvestment(a.id))"
                :key="acc.id"
                :value="acc.id.toString()"
              >
                {{ acc.accountName }}
              </option>
            </select>
          </div>
        </div>
        <div class="flex-1 relative min-h-0">
          <MarketVsBookList
            :account-id="bookValueAccountId"
            :transactions="globalInvestmentTransactions"
            :highlighted-symbol="highlightedSymbol"
            @open-history="handleOpenHistory"
          />
        </div>
      </div>

      <!-- Portfolio Allocation -->
      <div class="card p-4 lg:col-span-1 flex flex-col relative h-[350px]">
        <div class="absolute top-4 right-4 z-20 flex gap-2">
          <select
            v-model="allocationAccountId"
            class="text-[10px] lg:text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1 focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer max-w-[80px] truncate"
          >
            <option value="all">
              All
            </option>
            <option
              v-for="acc in store.accounts.filter(a => isInvestment(a.id))"
              :key="acc.id"
              :value="acc.id.toString()"
            >
              {{ acc.accountName }}
            </option>
          </select>
        </div>
        <div class="flex-1 relative min-h-0">
          <AssetAllocationChart
            :account-id="allocationAccountId"
            @highlight-asset="handleHighlightAsset"
          />
        </div>
      </div>
    </div>

    <!-- Charts Row 2 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Net Contributions History -->
      <div class="card p-4 flex flex-col h-[350px]">
        <div class="relative flex items-center justify-end mb-4 shrink-0 min-h-[32px]">
          <h3 class="absolute left-1/2 -translate-x-1/2 font-semibold text-gray-700 dark:text-gray-200 text-sm lg:text-base text-center whitespace-nowrap pointer-events-none hidden sm:block">
            Net Contributions History
          </h3>
          <h3 class="absolute left-0 font-semibold text-gray-700 dark:text-gray-200 text-sm lg:text-base text-center whitespace-nowrap pointer-events-none block sm:hidden">
            Net Contributions
          </h3>
          <div class="z-10 flex gap-2">
            <select
              v-model="contributionsAccountId"
              class="text-[10px] lg:text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1 focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer max-w-[80px] truncate"
            >
              <option value="all">
                Combined
              </option>
              <option
                v-for="acc in store.accounts.filter(a => isInvestment(a.id))"
                :key="acc.id"
                :value="acc.id.toString()"
              >
                {{ acc.accountName }}
              </option>
            </select>
            <select
              v-model="contributionsOption"
              class="text-[10px] lg:text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1 focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer"
            >
              <option value="YTD">
                YTD
              </option>
              <option value="all">
                All Time
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
        <div class="flex-1 relative min-h-0">
          <NetContributionsChart
            :account-id="contributionsAccountId"
            :option="contributionsOption"
            :adjustments="globalAdjustments"
          />
        </div>
      </div>

      <!-- Portfolio Value History -->
      <div class="card p-4 flex flex-col h-[350px]">
        <div class="relative flex items-center justify-end mb-4 shrink-0 min-h-[32px]">
          <h3 class="absolute left-1/2 -translate-x-1/2 font-semibold text-gray-700 dark:text-gray-200 text-sm lg:text-base text-center whitespace-nowrap pointer-events-none hidden sm:block">
            Portfolio Value History
          </h3>
          <h3 class="absolute left-0 font-semibold text-gray-700 dark:text-gray-200 text-sm lg:text-base text-center whitespace-nowrap pointer-events-none block sm:hidden">
            Portfolio Value
          </h3>
          <div class="z-10 flex gap-2">
            <select
              v-model="historyAccountId"
              class="text-[10px] lg:text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1 focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer max-w-[80px] truncate"
            >
              <option value="all">
                Combined
              </option>
              <option
                v-for="acc in store.accounts.filter(a => isInvestment(a.id))"
                :key="acc.id"
                :value="acc.id.toString()"
              >
                {{ acc.accountName }}
              </option>
            </select>
            <select
              v-model="historyOption"
              class="text-[10px] lg:text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1 focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer"
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
        <div class="flex-1 relative min-h-0">
          <PortfolioHistoryChart
            :history="computedHistoryData"
            :option="historyOption"
          />
        </div>
      </div>
    </div>

    <!-- Modals -->
    <TradeHistoryModal
      v-if="showHistoryModal"
      :holding="null"
      :account-id="modalHistoryAccountId"
      :is-cash="false"
      :initial-asset-filter="historyInitialAssetFilter"
      @close="showHistoryModal = false"
    />
  </div>
</template>

<style scoped>
.card {
    @apply bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700;
}
</style>