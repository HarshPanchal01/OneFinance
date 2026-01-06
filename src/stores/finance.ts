import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type {
  LedgerPeriod,
  Category,
  Account,
  AccountType,
  TransactionWithCategory,
  CreateTransactionInput,
  PeriodSummary,
  CategoryBreakdown,
  SearchOptions,
  MonthlyTrend,
} from "../types";

export const useFinanceStore = defineStore("finance", () => {
  // ============================================
  // STATE
  // ============================================

  // Current period selection
  const currentPeriod = ref<LedgerPeriod | null>(null);
  const selectedYear = ref<number | null>(null);
  const ledgerYears = ref<number[]>([]);
  const ledgerPeriods = ref<LedgerPeriod[]>([]);

  // Categories
  const categories = ref<Category[]>([]);

  // Accounts
  const accounts = ref<Account[]>([]);

  // AccountTypes
  const accountTypes = ref<AccountType[]>([]);

  // Transactions for current period (or Global if null)
  const transactions = ref<TransactionWithCategory[]>([]);
  // Global recent transactions (always Global)
  const recentTransactions = ref<TransactionWithCategory[]>([]);
  // Search results
  const searchResults = ref<TransactionWithCategory[]>([]);
  const isSearching = ref(false);

  // Summary data - always have default values
  const periodSummary = ref<PeriodSummary>({
    totalIncome: 0,
    totalExpenses: 0,
    balance: 0,
    transactionCount: 0,
  });
  const incomeBreakdown = ref<CategoryBreakdown[]>([]);
  const expenseBreakdown = ref<CategoryBreakdown[]>([]);
  const monthlyTrends = ref<MonthlyTrend[]>([]);

  // Loading states - separate for initial load vs period changes
  const isLoading = ref(true); // Initial load
  const isChangingPeriod = ref(false); // Period changes (doesn't hide UI)
  const error = ref<string | null>(null);

  // ============================================
  // GETTERS (Computed)
  // ============================================

  const hasCurrentPeriod = computed(() => currentPeriod.value !== null || selectedYear.value !== null);

  const incomeTransactions = computed(() =>
    transactions.value.filter((t) => t.type === "income")
  );

  const expenseTransactions = computed(() =>
    transactions.value.filter((t) => t.type === "expense")
  );

  // ============================================
  // ACTIONS - Initialization
  // ============================================

  async function initialize() {
    console.log("[Store] initialize() called");
    isLoading.value = true;
    error.value = null;

    try {
      // Load categories first (they're always needed)
      await fetchCategories();
      console.log("[Store] Categories loaded:", categories.value.length);

      // Load accounts they are always needed
      await fetchAccounts();
      await fetchAccountTypes();

      console.log("[Store] Accounts loaded:", accounts.value.length);
      console.log("[Store] AccountTypes loaded:", accountTypes.value.length);

      // Load years and periods
      ledgerYears.value = await window.electronAPI.getLedgerYears();
      ledgerPeriods.value = await window.electronAPI.getLedgerPeriods();
      console.log(
        "[Store] Years:",
        ledgerYears.value,
        "Periods:",
        ledgerPeriods.value.length
      );

      // Default to Global View (no current period)
      await clearPeriod();

    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to initialize";
      console.error("[Store] Initialization error:", e);
    } finally {
      isLoading.value = false;
      console.log(
        "[Store] Initialization complete, isLoading:",
        isLoading.value
      );
    }
  }

  // ============================================
  // ACTIONS - Period Management
  // ============================================

  async function createYear(year: number) {
    await window.electronAPI.createLedgerYear(year);
    // Auto-create all 12 months for the year
    for (let month = 1; month <= 12; month++) {
      await window.electronAPI.createLedgerPeriod(year, month);
    }
    ledgerYears.value = await window.electronAPI.getLedgerYears();
    ledgerPeriods.value = await window.electronAPI.getLedgerPeriods();
  }

  async function deleteYear(year: number) {
    await window.electronAPI.deleteLedgerYear(year);
    ledgerYears.value = await window.electronAPI.getLedgerYears();
    ledgerPeriods.value = await window.electronAPI.getLedgerPeriods();

    // If deleted current period's year, reset to Global
    if (currentPeriod.value?.year === year || selectedYear.value === year) {
      await clearPeriod();
    }
  }

  async function selectYear(year: number) {
    console.log(`[Store] selectYear called: ${year}`);
    isChangingPeriod.value = true;
    error.value = null;

    try {
      currentPeriod.value = null;
      selectedYear.value = year;

      // Fetch data for the selected year
      await fetchTransactions(null, year);
      await fetchPeriodSummary();
      await fetchMonthlyTrends(year);

      console.log(`[Store] Year data fetched`);
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to select year";
      console.error("[Store] Select year error:", e);
    } finally {
      isChangingPeriod.value = false;
    }
  }

  async function selectPeriod(year: number, month: number) {
    console.log(`[Store] selectPeriod called: ${year}-${month}`);
    isChangingPeriod.value = true;
    error.value = null;

    try {
      selectedYear.value = null; // Clear selected year
      currentPeriod.value = await window.electronAPI.createLedgerPeriod(
        year,
        month
      );
      console.log(`[Store] currentPeriod set to:`, currentPeriod.value);

      // Refresh periods list in case a new one was created
      ledgerPeriods.value = await window.electronAPI.getLedgerPeriods();

      // Fetch data for the selected period
      if (currentPeriod.value) {
        await fetchTransactions(currentPeriod.value.id);
        await fetchPeriodSummary();
        await fetchMonthlyTrends(currentPeriod.value.year);
      }

      console.log(`[Store] Period data fetched`);
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to select period";
      console.error("[Store] Select period error:", e);
    } finally {
      isChangingPeriod.value = false;
    }
  }

  async function clearPeriod() {
    console.log("[Store] clearPeriod called (Global Mode)");
    isChangingPeriod.value = true;
    currentPeriod.value = null;
    selectedYear.value = null;

    try {
      // Fetch Global Data
      await fetchRecentTransactions(5); // Ensure recent list is up to date
      await fetchTransactions(null); // All transactions
      await fetchPeriodSummary(); // Global summary
      await fetchMonthlyTrends(new Date().getFullYear()); // Default to current year for trends
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to load global data";
      console.error("[Store] Clear period error:", e);
    } finally {
      isChangingPeriod.value = false;
    }
  }

  // ============================================
  // ACTIONS - Accounts
  // ============================================

  async function fetchAccounts(){
    const accountsRaw = await window.electronAPI.getAccounts();
    const transactionsRaw = await window.electronAPI.getTransactions();

    accountsRaw.forEach(account => {
      const accountTransactions = transactionsRaw.filter(t => t.accountId === account.id);
      const transactionSum = accountTransactions.reduce((sum, t) => {
        return t.type === 'income' ? sum + t.amount : sum - t.amount;
      }, 0);
      account.balance = account.startingBalance + transactionSum;
    });

    accounts.value = accountsRaw;

  }

  async function fetchAccountTypes(){
    accountTypes.value = await window.electronAPI.getAccountTypes();
  }

  async function addAccount(account: Account){
    await window.electronAPI.insertAccount(account);
  }

  async function editAccount(account: Account){
    await window.electronAPI.editAccount(account);
  }

  async function removeAccount(id: number, strategy: 'transfer' | 'delete', transferToAccountId?: number){
    await window.electronAPI.deleteAccountById(id, strategy, transferToAccountId);
  }

  // ============================================
  // ACTIONS - Categories
  // ============================================

  async function fetchCategories() {
    categories.value = await window.electronAPI.getCategories();
  }

  async function addCategory(name: string, colorCode: string, icon: string) {
    const newCategory = await window.electronAPI.createCategory(
      name,
      colorCode,
      icon
    );
    categories.value.push(newCategory);
    return newCategory;
  }

  async function editCategory(
    id: number,
    name: string,
    colorCode: string,
    icon: string
  ) {
    const updated = await window.electronAPI.updateCategory(
      id,
      name,
      colorCode,
      icon
    );
    if (updated) {
      const index = categories.value.findIndex((c) => c.id === id);
      if (index !== -1) {
        categories.value[index] = updated;
      }
    }
    return updated;
  }

  async function removeCategory(id: number) {
    const success = await window.electronAPI.deleteCategory(id);
    if (success) {
      categories.value = categories.value.filter((c) => c.id !== id);
    }
    return success;
  }

  // ============================================
  // ACTIONS - Transactions
  // ============================================

  async function fetchTransactions(periodId?: number | null, year?: number | null) {
    transactions.value = await window.electronAPI.getTransactions(periodId, undefined, year);
  }

  async function fetchRecentTransactions(limit: number) {
    recentTransactions.value = await window.electronAPI.getTransactions(
      null,
      limit
    );
  }

  async function addTransaction(
    input: Omit<CreateTransactionInput, "ledgerPeriodId">
  ) {
    // Determine which period to attach this to.
    // If Global Mode (currentPeriod is null), we must infer or ask for period.
    // For now, if currentPeriod is null, we can try to find the period based on the date
    // or default to "current real world month" if we want to be smart.
    // BUT the simpler logic is: IF we are in a specific period, use it.
    // IF we are in Global Mode, we might need the User to specify, or we can auto-assign based on date.

    let targetPeriodId: number;

    if (currentPeriod.value) {
      targetPeriodId = currentPeriod.value.id;
    } else {
      // Global Mode: infer from date
      const date = new Date(input.date);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const period = await window.electronAPI.createLedgerPeriod(year, month);
      targetPeriodId = period.id;
    }

    const newTransaction = await window.electronAPI.createTransaction({
      ...input,
      ledgerPeriodId: targetPeriodId,
    });

    // Refresh Data
    await fetchRecentTransactions(5);

    // Only update main list if it matches current filter (Global or Specific Period)
    if (!currentPeriod.value || currentPeriod.value.id === targetPeriodId || (selectedYear.value && selectedYear.value === new Date(newTransaction.date).getFullYear())) {
        // Add to front if valid
        transactions.value.unshift(newTransaction);
        // Refresh summary
        await fetchPeriodSummary();
        // Refresh trends (use current viewed year, or transaction year)
        const yearToRefresh = currentPeriod.value ? currentPeriod.value.year : (selectedYear.value || new Date().getFullYear());
        await fetchMonthlyTrends(yearToRefresh);
    }

    return newTransaction;
  }

  async function editTransaction(
    id: number,
    input: Partial<CreateTransactionInput>
  ) {
    // If date is changing, we MUST ensure the ledgerPeriodId is updated to match
    const updateInput = { ...input };
    
    if (input.date) {
        const date = new Date(input.date);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        
        // Ensure the period exists
        const period = await window.electronAPI.createLedgerPeriod(year, month);
        updateInput.ledgerPeriodId = period.id;
    }

    const updated = await window.electronAPI.updateTransaction(id, updateInput);
    if (updated) {
      const index = transactions.value.findIndex((t) => t.id === id);
      if (index !== -1) {
        // If the date changed such that it moves out of the current view (if period specific),
        // we might want to remove it. But for simplicity, we just update it in place or re-fetch.
        // Re-fetching is safer.
        if (currentPeriod.value) {
            // Check if it still belongs?
            // Easier to just re-fetch the list to be safe
             await fetchTransactions(currentPeriod.value.id);
        } else if (selectedYear.value) {
             await fetchTransactions(null, selectedYear.value);
        } else {
             // Global mode, just update
             transactions.value[index] = updated;
        }
      }
      await fetchRecentTransactions(5); // Update dashboard list
      await fetchPeriodSummary(); // Refresh summary
      // Refresh trends
      const yearToRefresh = currentPeriod.value ? currentPeriod.value.year : (selectedYear.value || new Date().getFullYear());
      await fetchMonthlyTrends(yearToRefresh);
    }
    return updated;
  }

  async function removeTransaction(id: number) {
    const success = await window.electronAPI.deleteTransaction(id);
    if (success) {
      transactions.value = transactions.value.filter((t) => t.id !== id);
      await fetchRecentTransactions(5); // Update dashboard list
      await fetchPeriodSummary(); // Refresh summary
      
      // Also remove from search results if present
      if (isSearching.value) {
        searchResults.value = searchResults.value.filter((t) => t.id !== id);
      }
      // Refresh trends
      const yearToRefresh = currentPeriod.value ? currentPeriod.value.year : (selectedYear.value || new Date().getFullYear());
      await fetchMonthlyTrends(yearToRefresh);
    }
    return success;
  }

  async function searchTransactions(options: SearchOptions) {
    // If no criteria provided, clear search
    const hasCriteria = 
      (options.text && options.text.trim()) || 
      (options.categoryIds && options.categoryIds.length > 0) ||
      (options.accountIds && options.accountIds.length > 0) ||
      options.fromDate || 
      options.toDate ||
      options.minAmount ||
      options.maxAmount ||
      options.type;

    if (!hasCriteria) {
      isSearching.value = false;
      searchResults.value = [];
      return;
    }
    
    isSearching.value = true;
    try {
      searchResults.value = await window.electronAPI.searchTransactions(options);
    } catch (e) {
      console.error("[Store] Search error:", e);
      error.value = "Failed to search transactions";
    }
  }

  function clearSearch() {
    isSearching.value = false;
    searchResults.value = [];
  }

  // ============================================
  // ACTIONS - Summary / Dashboard
  // ============================================

  async function fetchPeriodSummary() {
    const periodId = currentPeriod.value?.id || null; // null = Global
    const year = selectedYear.value || null;

    const summary = await window.electronAPI.getPeriodSummary(periodId, year);

    periodSummary.value = summary || {
      totalIncome: 0,
      totalExpenses: 0,
      balance: 0,
      transactionCount: 0,
    };

    incomeBreakdown.value = await window.electronAPI.getCategoryBreakdown(
      periodId,
      "income",
      year
    );
    expenseBreakdown.value = await window.electronAPI.getCategoryBreakdown(
      periodId,
      "expense",
      year
    );
  }

  async function fetchMonthlyTrends(year: number) {
    try {
      monthlyTrends.value = await window.electronAPI.getMonthlyTrends(year);
    } catch (e) {
      console.error("[Store] Failed to fetch monthly trends:", e);
      // Don't break the UI, just empty trends
      monthlyTrends.value = [];
    }
  }

  // ============================================
  // RETURN STORE
  // ============================================

  return {
    // State
    currentPeriod,
    selectedYear,
    ledgerYears,
    ledgerPeriods,
    categories,
    accounts,
    accountTypes,
    transactions,
    recentTransactions,
    searchResults,
    isSearching,
    periodSummary,
    incomeBreakdown,
    expenseBreakdown,
    monthlyTrends,
    isLoading,
    isChangingPeriod,
    error,

    // Getters
    hasCurrentPeriod,
    incomeTransactions,
    expenseTransactions,

    // Actions
    initialize,
    createYear,
    deleteYear,
    selectPeriod,
    selectYear,
    clearPeriod,
    fetchCategories,
    addCategory,
    editCategory,
    removeCategory,
    fetchTransactions,
    fetchRecentTransactions,
    addTransaction,
    editTransaction,
    removeTransaction,
    searchTransactions,
    clearSearch,
    fetchPeriodSummary,
    fetchMonthlyTrends,
    fetchAccounts,
    fetchAccountTypes,
    removeAccount,
    addAccount,
    editAccount,
  };
});
