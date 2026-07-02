<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useFinanceStore } from "@/stores/finance";
import { useSettingsStore } from "@/stores/settings";
import { useFormatter } from "@/composables/useFormatter";
import TransactionItem from "@/components/TransactionItem.vue";
import TransactionModal from "@/components/TransactionModal.vue";
import ConfirmationModal from "@/components/ConfirmationModal.vue";
import { useTransactionActions } from "@/composables/useTransactionActions";
import InsightTimeRangeSelector from "@/views/insights/components/InsightTimeRangeSelector.vue";
import DashboardKpiCard from "@/views/dashboard/components/DashboardKpiCard.vue";
import NetWorthHeroChart from "@/views/dashboard/components/NetWorthHeroChart.vue";
import SpendingWidget from "@/views/dashboard/components/SpendingWidget.vue";
import UpcomingBillsWidget from "@/views/dashboard/components/UpcomingBillsWidget.vue";
import WatchlistWidget from "@/views/dashboard/components/WatchlistWidget.vue";
import DashboardCustomizeModal from "@/views/dashboard/components/DashboardCustomizeModal.vue";
import { useDashboardLayout } from "@/composables/useDashboardLayout";

const store = useFinanceStore();
const settingsStore = useSettingsStore();
const { formatCurrency } = useFormatter();

const {
  isVisible,
  orderedVisibleDetailIds,
  allHidden,
  currentLayout,
  applyLayout,
} = useDashboardLayout();
const showCustomize = ref(false);

const emit = defineEmits<{
  (e: "addTransaction"): void;
  (e: "request-edit-account", id: number): void;
  (e: "navigate", view: string): void;
  (e: "view-investments", symbol?: string): void;
  (e: "view-recurring", id?: number): void;
}>();

const kpis = computed(() => store.dashboardKpis);

const incomeSpark = computed(() => store.dashboardTrends.map((t) => t.totalIncome));
const expenseSpark = computed(() => store.dashboardTrends.map((t) => t.totalExpenses));
const netSpark = computed(() => store.dashboardTrends.map((t) => t.balance));

const rangeOptions = [
  { value: "thisMonth", label: "This Month" },
  { value: "last3Months", label: "Last 3 Months" },
  { value: "last6Months", label: "Last 6 Months" },
  { value: "thisYear", label: "This Year" },
  { value: "allTime", label: "All Time" },
  { value: "custom", label: "Custom" },
];

const greeting = computed(() => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning.";
  if (h < 18) return "Good afternoon.";
  return "Good evening.";
});

// Typewriter for the greeting.
const typedGreeting = ref("");
const isTyping = ref(true);
let typeTimer: number | undefined;

const rangeLabel = computed(
  () =>
    ({
      thisMonth: "this month",
      last3Months: "over the last 3 months",
      last6Months: "over the last 6 months",
      thisYear: "this year",
      allTime: "all-time",
      custom: "for the selected range",
    })[store.dashboardRange] ?? "this period"
);

// Privacy-aware one-line insight shown in the hero.
const insight = computed(() => {
  if (settingsStore.privacyMode) return "Here's your financial overview.";

  const k = kpis.value;
  if (k.income > 0 && k.net > 0) {
    return `You've saved ${Math.round((k.net / k.income) * 100)}% of your income ${rangeLabel.value}.`;
  }
  if (k.net < 0) {
    return `You're spending more than you earn ${rangeLabel.value} — worth a look.`;
  }
  return "Here's your financial overview.";
});

// The hero's secondary figure is the period's net cash flow (money in − out),
// not a net-worth delta: we can't model intra-period market moves, so a
// "net worth ▲ %" would be misleading for investors. Cash flow is honest and
// matches the Cash Flow KPI.
const cashFlowUp = computed(() => kpis.value.net >= 0);

onMounted(async () => {
  const full = greeting.value;
  let i = 0;
  typeTimer = window.setInterval(() => {
    i++;
    typedGreeting.value = full.slice(0, i);
    if (i >= full.length) {
      if (typeTimer) window.clearInterval(typeTimer);
      isTyping.value = false;
    }
  }, 95);

  await store.loadDashboard();
});

onUnmounted(() => {
  if (typeTimer) window.clearInterval(typeTimer);
});

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
    <!-- Header: title + period + Add -->
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
        <button
          class="inline-flex items-center justify-center h-10 w-10 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Customize dashboard"
          aria-label="Customize dashboard"
          @click="showCustomize = true"
        >
          <i class="pi pi-sliders-h" />
        </button>
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

    <!-- KPI stat cards -->
    <div
      v-if="isVisible('kpis')"
      class="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0"
    >
      <DashboardKpiCard
        label="Income"
        :value="kpis.income"
        :delta="kpis.incomeDelta"
        :sparkline="incomeSpark"
        accent="income"
        tooltip="Total income received in the selected period."
      />
      <DashboardKpiCard
        label="Expenses"
        :value="kpis.expenses"
        :delta="kpis.expensesDelta"
        :positive-is-good="false"
        :sparkline="expenseSpark"
        accent="expense"
        tooltip="Total spending in the selected period."
      />
      <DashboardKpiCard
        label="Cash Flow"
        :value="kpis.net"
        :delta="kpis.netDelta"
        :sparkline="netSpark"
        accent="primary"
        tooltip="Income minus expenses for the selected period — what you kept (or overspent)."
      />
    </div>

    <!-- Middle: net-worth hero -->
    <div
      v-if="isVisible('netWorth')"
      class="card relative overflow-hidden shrink-0 lg:h-72"
    >
      <div class="absolute inset-0">
        <NetWorthHeroChart />
      </div>
      <!-- Legibility wash so the text stays readable over the chart -->
      <div
        class="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent dark:from-gray-800 dark:via-gray-800/80 dark:to-transparent pointer-events-none"
      />

      <div class="relative z-10 h-full p-6 lg:p-8 flex flex-col">
        <p class="text-2xl font-semibold text-gray-600 dark:text-gray-300 min-h-[2rem]">
          {{ typedGreeting }}<span
            v-if="isTyping"
            class="type-cursor text-primary-500 font-normal"
          >|</span>
        </p>

        <div
          class="flex-1 flex flex-col justify-center min-h-0 animate-rise"
          style="animation-delay: 0.08s"
        >
          <p class="text-sm font-medium text-gray-500 dark:text-gray-400">
            Net Worth
          </p>
          <p
            class="text-4xl font-bold tracking-tight text-gray-900 dark:text-white mt-1"
            :class="{ 'privacy-blur': settingsStore.privacyMode }"
          >
            {{ formatCurrency(kpis.netWorth) }}
          </p>
          <p
            class="text-base lg:text-lg font-semibold mt-2 inline-flex items-center"
            :class="cashFlowUp ? 'text-income' : 'text-expense'"
          >
            <i
              class="pi text-sm mr-1.5"
              :class="cashFlowUp ? 'pi-arrow-up' : 'pi-arrow-down'"
            />
            <span :class="{ 'privacy-blur': settingsStore.privacyMode }">
              {{ formatCurrency(Math.abs(kpis.net)) }}
            </span>
            <span class="text-gray-400 dark:text-gray-500 font-normal ml-1.5">
              {{ cashFlowUp ? 'saved' : 'overspent' }} {{ rangeLabel }}
            </span>
          </p>
        </div>

        <p
          class="shrink-0 text-sm text-gray-500 dark:text-gray-400 animate-rise"
          style="animation-delay: 0.16s"
        >
          {{ insight }}
        </p>
      </div>
    </div>

    <!-- Bottom: details — ordered + reorderable; lists scroll inside their cards -->
    <div
      v-if="orderedVisibleDetailIds.length"
      class="flex-1 min-h-0 flex flex-col lg:flex-row gap-4"
    >
      <template
        v-for="widgetId in orderedVisibleDetailIds"
        :key="widgetId"
      >
        <div
          v-if="widgetId === 'recentTransactions'"
          class="lg:flex-[1.6] min-w-0 flex min-h-0"
        >
          <div class="card p-5 flex flex-col w-full min-h-0">
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

        <SpendingWidget
          v-else-if="widgetId === 'spending'"
          class="lg:flex-1 min-w-0"
          @navigate-transactions="emit('navigate', 'transactions')"
          @open-goals="emit('navigate', 'goals')"
        />
        <UpcomingBillsWidget
          v-else-if="widgetId === 'upcomingBills'"
          class="lg:flex-1 min-w-0"
          @open-recurring="(id) => emit('view-recurring', id)"
        />
        <WatchlistWidget
          v-else-if="widgetId === 'watchlist'"
          class="lg:flex-1 min-w-0"
          @view-investments="(s) => emit('view-investments', s)"
        />
      </template>
    </div>

    <!-- Empty state — every widget hidden -->
    <div
      v-if="allHidden"
      class="flex-1 min-h-0 flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400"
    >
      <i class="pi pi-th-large text-4xl text-gray-300 dark:text-gray-600 mb-3" />
      <p>All widgets are hidden.</p>
      <button
        class="btn-view-all mt-2"
        @click="showCustomize = true"
      >
        Customize dashboard
      </button>
    </div>
  </div>

  <DashboardCustomizeModal
    :visible="showCustomize"
    :layout="currentLayout"
    @close="showCustomize = false"
    @save="(layout) => { applyLayout(layout); showCustomize = false; }"
  />

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
