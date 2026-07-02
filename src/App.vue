<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useFinanceStore } from "@/stores/finance";
import { useSettingsStore } from "@/stores/settings";
import { useAuthStore } from "@/stores/auth";
import { useIdleLock } from "@/composables/useIdleLock";

// Components
import Sidebar from "@/components/Sidebar.vue";
import TopBar from "@/components/TopBar.vue";
import TransactionModal from "@/components/TransactionModal.vue";
import BackupSetupModal from "@/views/settings/components/BackupSetupModal.vue";
import MasterPasswordGate from "@/views/auth/MasterPasswordGate.vue";

// Views
import DashboardView from "@/views/DashboardView.vue";
import TransactionsView from "@/views/TransactionsView.vue";
import CategoriesView from "@/views/labels/LabelsView.vue";
import BudgetsView from "@/views/budgets/BudgetsView.vue";
import GoalsView from "@/views/goals/GoalsView.vue";
import SettingsView from "@/views/settings/SettingsView.vue";
import AccountsView from "@/views/accounts/AccountsView.vue";
import SpendingInsightsView from "@/views/insights/SpendingInsightsView.vue";
import RecurringView from "@/views/recurring/RecurringView.vue";
import PortfolioView from "@/views/investments/PortfolioView.vue";
import InvestmentInsightsView from "@/views/insights/InvestmentInsightsView.vue";
import CalculatorsView from "@/views/calculators/CalculatorsView.vue";
  
const store = useFinanceStore();
const settingsStore = useSettingsStore();
const auth = useAuthStore();

// The app stays gated behind the master-password screen until it is unlocked.
const authUnlocked = ref(false);
// One-time app setup runs on the first unlock; later unlocks (after a lock) skip it.
const appInitialized = ref(false);

// Current view
type ViewName = "dashboard" | "transactions" | "categories" | "budgets" | "goals" | "settings" | "accounts" | "insights" | "recurring" | "investments" | "investment-insights" | "calculators";
const currentView = ref<ViewName>("dashboard");

// Cross-view state
const activeAccountId = ref<number | null>(null);
const activeFilterAccountId = ref<number | null>(null);
const activeFilterRecurringId = ref<number | null>(null);
const activeHighlightSymbol = ref<string | null>(null);
const activeHighlightRecurringId = ref<number | null>(null);

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
const backupSetupModal = ref<InstanceType<typeof BackupSetupModal>>();

// Navigate to view
function navigateTo(view: string) {
  currentView.value = view as ViewName;
  
  // Clear cross-view state on manual navigation
  activeAccountId.value = null;
  activeFilterAccountId.value = null;
  activeFilterRecurringId.value = null;
  activeHighlightSymbol.value = null;
  activeHighlightRecurringId.value = null;

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

// Dashboard watchlist → Investments. A holding click expands its account(s) and
// highlights the row; "View all" (no symbol) expands every investment account.
function handleViewInvestments(symbol?: string) {
  const next = new Set(store.expandedInvestmentAccounts);
  if (symbol) {
    store.investmentHoldings
      .filter((h) => h.symbol === symbol)
      .forEach((h) => next.add(h.accountId));
  } else {
    store.accounts.forEach((a) => {
      const cls = store.accountTypes.find((t) => t.id === a.accountTypeId)?.classification;
      if (cls === "investment") next.add(a.id);
    });
  }
  store.expandedInvestmentAccounts = next;
  activeHighlightSymbol.value = symbol ?? null;
  currentView.value = "investments";
}

// Dashboard upcoming bills → Schedules with the schedule highlighted.
function handleViewRecurring(id?: number) {
  activeHighlightRecurringId.value = id ?? null;
  currentView.value = "recurring";
}

// Apply theme before the gate renders so the unlock screen is themed. Everything
// that touches the (encrypted) database waits until onUnlocked.
onMounted(() => {
  settingsStore.loadSettings();
});

// Runs each time the gate unlocks. One-time setup happens on the first unlock;
// later unlocks (after a lock) only refresh data that may have changed.
async function onUnlocked() {
  authUnlocked.value = true;
  // Let the main UI (and its modal refs) mount before using them.
  await nextTick();

  if (!appInitialized.value) {
    appInitialized.value = true;
    await initializeApp();
  } else {
    await refreshAfterUnlock();
  }
}

// One-time setup after the first successful unlock: load preferences, wire up
// background-event listeners and timers, and pull initial data.
async function initializeApp() {
  await settingsStore.loadBackupSettings();
  await settingsStore.loadAppPreferences();

  window.electronAPI.onSilentBackupComplete(() => {
    settingsStore.refreshLastBackupDate();
  });

  if (!settingsStore.hasSeenBackupPrompt) {
    settingsStore.hasSeenBackupPrompt = true;
    const didEnable = await backupSetupModal.value?.open();
    if (didEnable) {
      await settingsStore.loadBackupSettings();
    }
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (settingsStore.appearance === 'system') {
      settingsStore.applyAppearance();
    }
  });

  await store.initialize();

  // Auto-fetch investment prices on startup
  await store.fetchInvestmentHoldings();
  store.refreshInvestmentPrices();

  // Refresh investment prices every 30 minutes (skipped while locked — the DB is
  // closed and persisting quotes would throw).
  window.setInterval(() => {
    if (!authUnlocked.value) return;
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

  // Listen for background savings interest
  window.electronAPI.onSavingsInterestProcessed(async () => {
    console.log("Background savings interest processed, refreshing...");
    await store.fetchTransactions(store.currentLedgerMonth, store.selectedYear ?? undefined);
    await store.fetchAccounts();
    store.fetchPeriodSummarySync();
  });

  // Refresh schedules when a payment reminder notification fires (keeps lastNotifiedDate in sync)
  window.electronAPI.onReminderNotified(async () => {
    await store.fetchRecurringTransactions();
  });

  // Clicking a reminder notification navigates to the Schedules view
  window.electronAPI.onNavigateReminders(() => {
    currentView.value = "recurring";
  });

  // Clicking a price-alert notification navigates to the Investments view
  window.electronAPI.onNavigateInvestments(() => {
    currentView.value = "investments";
  });

  // The main process re-locks on OS suspend / screen lock; reflect that here.
  window.electronAPI.onAppLocked(() => {
    auth.markLocked();
  });

  // Mirror the UI's formatting locale/currency to the main process so reminder
  // notifications format amounts identically to the on-screen UI.
  const syncReminderLocale = () => {
    void window.electronAPI.setReminderLocale(settingsStore.formattingLocale, settingsStore.currency);
  };
  syncReminderLocale();
  watch(() => [settingsStore.formattingLocale, settingsStore.currency], syncReminderLocale);

  // Add keyboard shortcuts
  window.addEventListener("keydown", handleKeydown);
}

// After re-unlocking (post-lock), the background heartbeat resumes and may have
// caught up on recurring transactions / savings interest; pull the latest data.
async function refreshAfterUnlock() {
  await store.fetchRecurringTransactions();
  await store.fetchTransactions(store.currentLedgerMonth, store.selectedYear ?? undefined);
  await store.fetchAccounts();
  store.fetchPeriodSummarySync();
  // Refresh quotes so the dashboard watchlist's day-change repopulates — the
  // previous-close map is in-memory and isn't refreshed while locked.
  store.refreshInvestmentPrices();
}

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});

// Auto-lock on inactivity (Off when autoLockMinutes is 0). Disarms automatically
// while locked because `enabled` (authUnlocked) is false.
useIdleLock({
  enabled: authUnlocked,
  timeoutMs: computed(() => settingsStore.autoLockMinutes * 60 * 1000),
  onIdle: () => void auth.lock(),
});

// Every lock path clears auth.isUnlocked (manual, idle, or OS-initiated); drop
// back to the gate whenever that happens.
watch(
  () => auth.isUnlocked,
  (unlocked) => {
    if (!unlocked) authUnlocked.value = false;
  },
);

// Keyboard shortcuts
function handleKeydown(e: KeyboardEvent) {
  if (!authUnlocked.value) return;
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
              if (e.shiftKey) {
                void auth.lock();
              } else {
                currentView.value = "categories";
              }
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
  <MasterPasswordGate
    v-if="!authUnlocked"
    :allow-auto-unlock="!appInitialized"
    @unlocked="onUnlocked"
  />
  <div
    v-else
    class="flex h-screen bg-gray-100 dark:bg-gray-900"
  >
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
            @navigate="navigateTo"
            @view-investments="handleViewInvestments"
            @view-recurring="handleViewRecurring"
          />
          <TransactionsView
            v-else-if="currentView === 'transactions'"
            @request-edit-account="handleRequestEditAccount"
          />
          <CategoriesView v-else-if="currentView === 'categories'" />
          <BudgetsView
            v-else-if="currentView === 'budgets'"
            @navigate-transactions="currentView = 'transactions'"
          />
          <GoalsView v-else-if="currentView === 'goals'" />
          <SettingsView v-else-if="currentView === 'settings'" />
          <AccountsView
            v-else-if="currentView === 'accounts'"
            :highlight-account-id="activeAccountId"
            @request-view-transactions="handleRequestViewTransactions"
          />
          <SpendingInsightsView v-else-if="currentView === 'insights'" />
          <PortfolioView
            v-else-if="currentView === 'investments'"
            :highlight-symbol="activeHighlightSymbol"
          />
          <InvestmentInsightsView v-else-if="currentView === 'investment-insights'" />
          <RecurringView
            v-else-if="currentView === 'recurring'"
            :highlight-recurring-id="activeHighlightRecurringId"
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

    <!-- First-run backup setup prompt -->
    <BackupSetupModal ref="backupSetupModal" />
  </div>
</template>