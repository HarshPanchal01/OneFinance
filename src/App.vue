<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { useFinanceStore } from "@/stores/finance";
import { useSettingsStore } from "@/stores/settings";

// Components
import Sidebar from "@/components/Sidebar.vue";
import TopBar from "@/components/TopBar.vue";
import TransactionModal from "@/components/TransactionModal.vue";

// Views
import DashboardView from "@/views/DashboardView.vue";
import TransactionsView from "@/views/TransactionsView.vue";
import CategoriesView from "@/views/labels/LabelsView.vue";
import SettingsView from "@/views/settings/SettingsView.vue";
import AccountsView from "@/views/accounts/AccountsView.vue";
import SpendingInsightsView from "@/views/insights/SpendingInsightsView.vue";
import RecurringView from "@/views/recurring/RecurringView.vue";
import PortfolioView from "@/views/investments/PortfolioView.vue";
import InvestmentInsightsView from "@/views/insights/InvestmentInsightsView.vue";
import CalculatorsView from "@/views/calculators/CalculatorsView.vue";
  
const store = useFinanceStore();

// Current view
type ViewName = "dashboard" | "transactions" | "categories" | "settings" | "accounts" | "insights" | "recurring" | "investments" | "investment-insights" | "calculators";
const currentView = ref<ViewName>("dashboard");

// Cross-view state
const activeAccountId = ref<number | null>(null);
const activeFilterAccountId = ref<number | null>(null);
const activeFilterRecurringId = ref<number | null>(null);

// Watch for search active
watch(
  () => store.isSearching,
  (isSearching) => {
    if (isSearching) {
      currentView.value = "transactions";
    }
  }
);

// Quick add transaction modal
const showQuickAddModal = ref(false);

// Navigate to view
function navigateTo(view: string) {
  currentView.value = view as ViewName;
  
  // Clear cross-view state on manual navigation
  activeAccountId.value = null;
  activeFilterAccountId.value = null;
  activeFilterRecurringId.value = null;

  if (view === "dashboard") {
    // Keep the current period context when going to Dashboard
    // But fetch summary to ensure cards are up to date
    store.fetchPeriodSummarySync();
  }
  // Transactions logic is handled by Sidebar emitting specific events or store actions
}

function handleRequestEditAccount(id: number) {
  activeAccountId.value = id;
  currentView.value = "accounts";
  // Reset after a tick to allow re-triggering if needed, though prop watcher handles it
  // But keeping it as state is fine.
}

function handleRequestViewTransactions(id: number, type: 'account' | 'recurring' = 'account') {
  if (type === 'account') {
    activeFilterAccountId.value = id;
  } else if (type === 'recurring') {
    activeFilterRecurringId.value = id;
  }
  currentView.value = "transactions";
}

// Initialize on mount
onMounted(async () => {
  const settingsStore = useSettingsStore();
  settingsStore.loadSettings();

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (settingsStore.appearance === 'system') {
      settingsStore.applyAppearance();
    }
  });

  await store.initialize();

  // Auto-fetch investment prices on startup
  await store.fetchInvestmentHoldings();
  store.refreshInvestmentPrices();

  // Refresh investment prices every 30 minutes
  window.setInterval(() => {
    store.refreshInvestmentPrices();
  }, 30 * 60 * 1000);

  // Listen for background recurring transactions
  window.electronAPI.onRecurringProcessed(async () => {
    console.log("Background recurring transactions processed, refreshing...");
    await store.fetchRecurringTransactions();
    await store.fetchTransactions(store.currentLedgerMonth, store.selectedYear ?? undefined);
    await store.fetchAccounts();
    store.fetchPeriodSummarySync();
  });

  // Add keyboard shortcuts
  window.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});

// Keyboard shortcuts
function handleKeydown(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey) {
    switch (e.key.toLowerCase()) {
      case "n":
        e.preventDefault();
        showQuickAddModal.value = true;
        break;
      case "d":
        e.preventDefault();
        currentView.value = "dashboard";
        break;
            case "t":
              e.preventDefault();
              currentView.value = "transactions";
              break;
            case "i":
              e.preventDefault();
              if (e.shiftKey) {
                currentView.value = "investments";
              } else {
                currentView.value = "insights";
              }
              break;
            case "l":
              e.preventDefault();
              currentView.value = "categories";
              break;
            case "a":
              if (e.shiftKey) {
                e.preventDefault();
                currentView.value = "accounts";
              }
              break;
            case "s":
              e.preventDefault();
              if (e.shiftKey) {
                currentView.value = "settings";
              } else {
                currentView.value = "recurring";
              }
              break;
            case "p":
              e.preventDefault();
              if (e.shiftKey) {
                // Toggle privacy mode
                const settingsStore = useSettingsStore();
                settingsStore.togglePrivacyMode();
              } else {
                currentView.value = "investment-insights";
              }
              break;    
    }
  }
}
</script>

<template>
  <div class="flex h-screen bg-gray-100 dark:bg-gray-900">
    <!-- Sidebar -->
    <Sidebar
      :current-view="currentView"
      @navigate="navigateTo"
    />

    <!-- Main Content -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Top Bar -->
      <TopBar 
        v-if="currentView === 'transactions'" 
        :initial-account-id="activeFilterAccountId"
        :initial-recurring-id="activeFilterRecurringId"
      />

      <!-- Content Area -->
      <main class="flex-1 overflow-hidden p-4 flex flex-col min-h-0">
        <!-- Loading State -->
        <div
          v-if="store.isLoading"
          class="flex items-center justify-center py-12"
        >
          <div
            class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"
          />
        </div>

        <!-- Error State -->
        <div
          v-else-if="store.error"
          class="card p-6 text-center"
        >
          <i class="pi pi-exclamation-circle text-4xl text-expense mb-3" />
          <p class="text-expense">
            {{ store.error }}
          </p>
        </div>

        <!-- Views -->
        <template v-else>
          <DashboardView
            v-if="currentView === 'dashboard'"
            @add-transaction="showQuickAddModal = true"
            @request-edit-account="handleRequestEditAccount"
          />
          <TransactionsView
            v-else-if="currentView === 'transactions'"
            @request-edit-account="handleRequestEditAccount"
          />
          <CategoriesView v-else-if="currentView === 'categories'" />
          <SettingsView v-else-if="currentView === 'settings'" />
          <AccountsView
            v-else-if="currentView === 'accounts'"
            :highlight-account-id="activeAccountId"
            @request-view-transactions="handleRequestViewTransactions"
          />
          <SpendingInsightsView v-else-if="currentView === 'insights'" />
          <PortfolioView v-else-if="currentView === 'investments'" />
          <InvestmentInsightsView v-else-if="currentView === 'investment-insights'" />
          <RecurringView
            v-else-if="currentView === 'recurring'"
            @request-view-transactions="handleRequestViewTransactions"
            @request-edit-account="handleRequestEditAccount"
          />
          <!-- Always mounted so user inputs survive navigation between views -->
          <CalculatorsView v-show="currentView === 'calculators'" />
        </template>
      </main>
    </div>

    <!-- Quick Add Transaction Modal -->
    <TransactionModal
      :visible="showQuickAddModal"
      :default-year="store.currentLedgerMonth?.year"
      :default-month="store.currentLedgerMonth?.month"
      @close="showQuickAddModal = false"
      @saved="showQuickAddModal = false"
    />
  </div>
</template>