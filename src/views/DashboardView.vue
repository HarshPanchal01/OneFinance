<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useFinanceStore } from "@/stores/finance";
import TransactionItem from "@/components/TransactionItem.vue";
import TransactionModal from "@/components/TransactionModal.vue";
import ConfirmationModal from "@/components/ConfirmationModal.vue";
import { useTransactionActions } from "@/composables/useTransactionActions";
import InsightTimeRangeSelector from "@/views/insights/components/InsightTimeRangeSelector.vue";
import DashboardKpiCard from "@/views/dashboard/components/DashboardKpiCard.vue";
import NetWorthCompositionWidget from "@/views/dashboard/components/NetWorthCompositionWidget.vue";
import AccountsGlanceWidget from "@/views/dashboard/components/AccountsGlanceWidget.vue";
import TopSpendingWidget from "@/views/dashboard/components/TopSpendingWidget.vue";
import UpcomingBillsWidget from "@/views/dashboard/components/UpcomingBillsWidget.vue";
import WatchlistWidget from "@/views/dashboard/components/WatchlistWidget.vue";

const store = useFinanceStore();

const emit = defineEmits<{
  (e: "addTransaction"): void;
  (e: "request-edit-account", id: number): void;
  (e: "navigate", view: string): void;
  (e: "view-accounts", classification?: string): void;
  (e: "view-investments", symbol?: string): void;
  (e: "view-recurring", id?: number): void;
}>();

onMounted(async () => {
  await store.loadDashboard();
});

const kpis = computed(() => store.dashboardKpis);

const incomeSpark = computed(() => store.dashboardTrends.map((t) => t.totalIncome));
const expenseSpark = computed(() => store.dashboardTrends.map((t) => t.totalExpenses));
const netSpark = computed(() => store.dashboardTrends.map((t) => t.balance));
const netWorthSpark = computed(() => store.netWorthTrends.map((p) => p.balance));

const rangeOptions = [
  { value: "thisMonth", label: "This Month" },
  { value: "last3Months", label: "Last 3 Months" },
  { value: "last6Months", label: "Last 6 Months" },
  { value: "thisYear", label: "This Year" },
  { value: "allTime", label: "All Time" },
  { value: "custom", label: "Custom" },
];

const {
  showModal,
  editingTransaction,
  confirmModal,
  openEditModal,
  deleteTransaction,
  closeModal,
} = useTransactionActions();

// Silence unused variable warning for template ref
void confirmModal;
</script>

<template>
  <div class="h-full flex flex-col gap-4 min-h-0">
    <!-- Header: title + period selector + add -->
    <div class="flex items-center justify-between gap-3 shrink-0">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p class="text-gray-500 dark:text-gray-400 mt-1">
          Your finances at a glance.
        </p>
      </div>
      <div class="flex items-center gap-3">
        <InsightTimeRangeSelector
          v-model="store.dashboardRange"
          v-model:custom-range="store.dashboardCustomRange"
          :options="rangeOptions"
        />
        <button
          class="inline-flex items-center px-5 py-2 bg-primary-500 dark:bg-primary-900/40 text-white dark:text-primary-300 hover:bg-primary-600 dark:hover:bg-primary-900/60 font-medium rounded-lg transition-colors whitespace-nowrap"
          @click="emit('addTransaction')"
        >
          <i class="pi pi-plus mr-2" />
          Add Transaction
        </button>
      </div>
    </div>

    <!-- KPI strip -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
      <DashboardKpiCard
        label="Income"
        :value="kpis.income"
        :delta="kpis.incomeDelta"
        :sparkline="incomeSpark"
        accent="income"
        icon="pi-arrow-up"
        tooltip="Total income received in the selected period."
      />
      <DashboardKpiCard
        label="Expenses"
        :value="kpis.expenses"
        :delta="kpis.expensesDelta"
        :positive-is-good="false"
        :sparkline="expenseSpark"
        accent="expense"
        icon="pi-arrow-down"
        tooltip="Total spending in the selected period."
      />
      <DashboardKpiCard
        label="Cash Flow"
        :value="kpis.net"
        :delta="kpis.netDelta"
        :sparkline="netSpark"
        accent="primary"
        icon="pi-wallet"
        tooltip="Income minus expenses for the selected period — what you kept (or overspent)."
      />
      <DashboardKpiCard
        label="Net Worth"
        :value="kpis.netWorth"
        :delta="kpis.netWorthDelta"
        :sparkline="netWorthSpark"
        accent="primary"
        icon="pi-chart-line"
        tooltip="Everything you own minus everything you owe, across all accounts."
      />
    </div>

    <!-- Body fills the remaining height; long lists scroll inside their own card -->
    <div class="flex-1 min-h-0 flex flex-col lg:flex-row gap-4">
      <!-- Column 1: net worth composition + recent transactions -->
      <div class="lg:flex-[1.5] flex flex-col gap-4 min-h-0 min-w-0">
        <NetWorthCompositionWidget
          class="shrink-0 lg:h-52"
          @view-accounts="(c) => emit('view-accounts', c)"
        />

        <div class="card p-5 flex flex-col flex-1 min-h-0">
          <div class="flex items-center justify-between mb-4 shrink-0">
            <h2 class="text-base font-semibold text-gray-900 dark:text-white">
              Recent Transactions
            </h2>
            <button
              class="btn-view-all"
              @click="emit('navigate', 'transactions')"
            >
              View all
            </button>
          </div>

          <div class="flex-1 min-h-0 overflow-y-auto -mr-3 pr-3">
            <div
              v-if="store.recentTransactions.length === 0"
              class="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400"
            >
              <i class="pi pi-inbox text-4xl text-gray-300 dark:text-gray-600 mb-3" />
              <p>No transactions yet</p>
              <p class="text-sm mt-1">
                Add your first transaction to get started!
              </p>
            </div>

            <div
              v-else
              class="space-y-2"
            >
              <TransactionItem
                v-for="transaction in store.recentTransactions"
                :key="transaction.id"
                :transaction="transaction"
                @edit="openEditModal"
                @delete="deleteTransaction"
                @edit-account="(id) => emit('request-edit-account', id)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Column 2: accounts + top spending -->
      <div class="lg:flex-[1] flex flex-col gap-4 min-h-0 min-w-0">
        <div class="flex-1 min-h-0">
          <AccountsGlanceWidget
            @edit-account="(id) => emit('request-edit-account', id)"
            @view-accounts="emit('view-accounts')"
          />
        </div>
        <div class="flex-1 min-h-0">
          <TopSpendingWidget @navigate-transactions="emit('navigate', 'transactions')" />
        </div>
      </div>

      <!-- Column 3: upcoming bills + watchlist -->
      <div class="lg:flex-[1] flex flex-col gap-4 min-h-0 min-w-0">
        <div class="flex-1 min-h-0">
          <UpcomingBillsWidget @open-recurring="(id) => emit('view-recurring', id)" />
        </div>
        <div class="flex-1 min-h-0">
          <WatchlistWidget @view-investments="(s) => emit('view-investments', s)" />
        </div>
      </div>
    </div>
  </div>

  <TransactionModal
    :visible="showModal"
    :transaction="editingTransaction"
    :default-year="store.currentLedgerMonth?.year"
    :default-month="store.currentLedgerMonth?.month"
    @close="closeModal"
    @saved="closeModal"
  />

  <ConfirmationModal ref="confirmModal" />
</template>
