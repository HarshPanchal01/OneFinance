import { defineStore } from "pinia";
import { ref, computed, toRaw } from "vue";
import { toIsoDateString, getExpenseBreakdownForRange, getIncomeBreakdownForRange, type ImportData } from "@/utils";
import type {
  Category,
  Account,
  AccountType,
  TransactionWithCategory,
  CreateTransactionInput,
  PeriodSummary,
  CategoryBreakdown,
  SearchOptions,
  MonthlyTrend,
  DailyTransactionSum,
  LedgerMonth,
  RecurringTransaction,
  InvestmentHolding,
  InvestmentTransaction,
  InvestmentHistory,
} from "@/types";

export const useFinanceStore = defineStore("finance", () => {
  // ============================================
  // STATE
  // ============================================

  // Current period selection
  const currentLedgerMonth = ref<LedgerMonth | null>(null);
  const selectedYear = ref<number | null>(null);
  const ledgerYears = ref<number[]>([]);
  const ledgerMonths = ref<LedgerMonth[]>([]);

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
  // Recurring transactions
  const recurringTransactions = ref<RecurringTransaction[]>([]);
  // Search results
  const searchResults = ref<TransactionWithCategory[]>([]);
  const isSearching = ref(false);
  const transactionFilter = ref<SearchOptions | null>(null);

  const databaseVersion = ref<number>(0);

  // Summary data - always have default values
  const periodSummary = ref<PeriodSummary>({
    totalIncome: 0,
    totalExpenses: 0,
    balance: 0,
    transactionCount: 0,
  });
  const incomeBreakdown = ref<CategoryBreakdown[]>([]);
  const expenseBreakdown = ref<CategoryBreakdown[]>([]);
  const dashboardBreakdown = ref<CategoryBreakdown[]>([]);
  const dashboardIncomeBreakdown = ref<CategoryBreakdown[]>([]);
  const monthlyTrends = ref<MonthlyTrend[]>([]);
  const netWorthTrends = ref<{ month: number, year: number, balance: number }[]>([]);

  // UI State
  const expandedAccountSections = ref<Set<string>>(new Set());
  const expandedInvestmentAccounts = ref<Set<number>>(new Set());

  // Investment State
  const investmentHoldings = ref<InvestmentHolding[]>([]);
  const investmentTransactions = ref<InvestmentTransaction[]>([]);
  const investmentHistory = ref<InvestmentHistory[]>([]);

  const refreshCooldown = ref(0);
  let cooldownInterval: number | undefined;

  function startRefreshCooldown(seconds: number = 10) {
    if (cooldownInterval) window.clearInterval(cooldownInterval);
    refreshCooldown.value = seconds;
    cooldownInterval = window.setInterval(() => {
      refreshCooldown.value--;
      if (refreshCooldown.value <= 0) {
        window.clearInterval(cooldownInterval);
      }
    }, 1000);
  }

  // Loading states - separate for initial load vs period changes
  const isLoading = ref(true); // Initial load
  const isChangingPeriod = ref(false); // Period changes (doesn't hide UI)
  const error = ref<string | null>(null);

  // ============================================
  // GETTERS (Computed)
  // ============================================

  const hasCurrentPeriod = computed(() => currentLedgerMonth.value !== null);

  const incomeTransactions = computed(() =>
    transactions.value.filter((t) => t.type === "income" || (t.type === "transfer" && Boolean(t.isIncomeTransfer)))
  );

  const expenseTransactions = computed(() =>
    transactions.value.filter((t) => t.type === "expense" || (t.type === "transfer" && Boolean(t.isExpenseTransfer)))
  );

  const transferTransactions = computed(() =>
    transactions.value.filter((t) => t.type === "transfer")
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
      
      // Load recurring transactions
      await fetchRecurringTransactions();

      databaseVersion.value = await window.electronAPI.getDatabaseVersion();

      console.log("[Store] Accounts loaded:", accounts.value.length);
      console.log("[Store] AccountTypes loaded:", accountTypes.value.length);

      // Load years and periods
      ledgerYears.value = await window.electronAPI.getLedgerYears();

      //const ledgerPeriodsList: LedgerPeriod[] = [];
      for (const year of ledgerYears.value) {
        createLedgerPeriodSync(year);
      }

      //ledgerPeriods.value = ledgerPeriodsList;

      console.log(
        "[Store] Years:",
        ledgerYears.value,
        "Periods:",
        ledgerMonths.value.length
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

  function createLedgerPeriodSync(year: number){
    for (let month = 1; month <= 12; month++) {
      const period = {month, year};

      //Prevents duplicates when rebuilding UI (UI bug when running developer mode, not sure if it happens in production though)
      if (ledgerMonths.value.filter((value) => value.month === month && value.year === year).length > 0){
        continue;
      }

      ledgerMonths.value.push(period);
    }
  }

  function deleteLedgerPeriodsByYearSync(year: number){
    ledgerMonths.value = ledgerMonths.value.filter((item) => item.year !== year);
  }

  function fetchPeriodSummarySync(){
    // periodSummary
    // incomeBreakdown
    // expenseBreakdown

    const allTransactions = transactions.value;
    const transactionsByIncome = allTransactions.filter((t) => t.type === "income" || (t.type === "transfer" && Boolean(t.isIncomeTransfer)));
    const transactionsByExpense = allTransactions.filter((t) => t.type === "expense" || (t.type === "transfer" && Boolean(t.isExpenseTransfer)));

    const transactionsIncomeSum = transactionsByIncome.reduce((sum, t) => sum + t.amount, 0);
    const transactionsExpenseSum = transactionsByExpense.reduce((sum, t) => sum + t.amount, 0);

    const incomeCategoryBreakdown = new Map<number, CategoryBreakdown>();
    const expenseCategoryBreakdown = new Map<number, CategoryBreakdown>();

    for(const income of transactionsByIncome){
      if (income.categoryId == null || income.categoryName == null) continue;

      const entry = incomeCategoryBreakdown.get(income.categoryId);

      if (entry !== undefined) {
        entry.count += 1;
        entry.total += income.amount;
      } 
      else{
        incomeCategoryBreakdown.set(income.categoryId, 
          { categoryId: income.categoryId,
            categoryName: income.categoryName,
            categoryColor: income.categoryColor || '#6b7280',
            categoryIcon: income.categoryIcon || 'pi-tag',
            total: income.amount,
            count: 1
        });
      }
    }


    for(const expense of transactionsByExpense){
      if (expense.categoryId == null || expense.categoryName == null) continue;

      const entry = expenseCategoryBreakdown.get(expense.categoryId);
      if (entry != undefined) {
        entry.count += 1;
        entry.total += expense.amount;
      }
      else {
        expenseCategoryBreakdown.set(expense.categoryId, 
          { categoryId: expense.categoryId,
            categoryName: expense.categoryName,
            categoryColor: expense.categoryColor || '#6b7280',
            categoryIcon: expense.categoryIcon || 'pi-tag',
            total: expense.amount,
            count: 1
        });
      }
    }

    periodSummary.value.balance = transactionsIncomeSum - transactionsExpenseSum;
    periodSummary.value.totalExpenses = transactionsExpenseSum;
    periodSummary.value.totalIncome = transactionsIncomeSum;

    incomeBreakdown.value = Array.from(incomeCategoryBreakdown.values());
    expenseBreakdown.value = Array.from(expenseCategoryBreakdown.values());
  }

  async function createYear(year: number) {
    await window.electronAPI.createLedgerYear(year);
    createLedgerPeriodSync(year);
    // Auto-create all 12 months for the year
    ledgerYears.value = await window.electronAPI.getLedgerYears();
  }

  async function deleteYear(year: number, deleteTransactions: boolean = false) {
    await window.electronAPI.deleteLedgerYear(year, deleteTransactions);
    deleteLedgerPeriodsByYearSync(year);
    ledgerYears.value = await window.electronAPI.getLedgerYears();
    //ledgerPeriods.value = await window.electronAPI.getLedgerPeriods();

    // If deleted current period's year, reset to Global
    if (currentLedgerMonth.value?.year === year) {
      await clearPeriod();
    }
  }

  async function selectYear(year: number) {
    console.log(`[Store] selectYear called: ${year}`);
    isChangingPeriod.value = true;
    error.value = null;

    try {
      currentLedgerMonth.value = null;
      selectedYear.value = year;

      // Fetch data for the selected year
      await fetchTransactions(null, year);
      fetchPeriodSummarySync();
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
      currentLedgerMonth.value = {year: year, month: month};
      console.log(`[Store] currentPeriod set to:`, currentLedgerMonth.value);

      // Refresh periods list in case a new one was created
      //ledgerPeriods.value = await window.electronAPI.getLedgerPeriods();

      // Fetch data for the selected period
      if (currentLedgerMonth.value) {
        await fetchTransactions(toRaw(currentLedgerMonth.value));
        fetchPeriodSummarySync();
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
    currentLedgerMonth.value = null;
    selectedYear.value = null;

    try {
      // Fetch Global Data
      await fetchRecentTransactions(5); // Ensure recent list is up to date
      await fetchDashboardBreakdown(); // Last 30 days breakdown for dashboard
      await fetchTransactions(); // All transactions
      await fetchPeriodSummarySync(); // Global summary
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
    const holdingsRaw = await window.electronAPI.getInvestmentHoldings();
    const adjustmentsRaw = await window.electronAPI.getInvestmentAdjustments();
    const investmentTransactionsRaw = await window.electronAPI.getAllInvestmentTransactions();

    accountsRaw.forEach(account => {
      // Find transactions where this account is either the source or the destination
      const accountTransactions = transactionsRaw.filter(t => t.accountId === account.id || t.transferAccountId === account.id);
      
      const transactionSum = accountTransactions.reduce((sum, t) => {
        if (t.type === 'income') return sum + t.amount;
        if (t.type === 'expense') return sum - t.amount;
        if (t.type === 'transfer') {
          if (t.accountId === account.id) return sum - t.amount; // Outflow
          if (t.transferAccountId === account.id) return sum + t.amount; // Inflow
        }
        return sum;
      }, 0);

      // Add investment adjustments
      const accountAdjustments = adjustmentsRaw.filter(a => a.accountId === account.id);
      const adjustmentSum = accountAdjustments.reduce((sum, a) => {
        if (a.type === 'income') return sum + a.amount;
        if (a.type === 'expense') return sum - a.amount;
        return sum;
      }, 0);

      // Add investment trades (cash impact of buys/sells)
      const accountHoldings = holdingsRaw.filter(h => h.accountId === account.id);
      const accountHoldingIds = accountHoldings.map(h => h.id);
      const accountInvestmentTransactions = investmentTransactionsRaw.filter(it => accountHoldingIds.includes(it.holdingId));
      
      const investmentTradeSum = accountInvestmentTransactions.reduce((sum, it) => {
        if (it.type === 'buy') return sum - (it.quantity * it.price + it.fees);
        if (it.type === 'sell') return sum + (it.quantity * it.price - it.fees);
        if (it.type === 'drip') return sum - it.fees;
        return sum;
      }, 0);

      // Add investment holdings current market value
      const holdingsValue = accountHoldings.reduce((sum, h) => sum + (h.quantity * (h.lastPrice || 0)), 0);

      account.balance = account.startingBalance + transactionSum + adjustmentSum + investmentTradeSum + holdingsValue;
    });

    accounts.value = accountsRaw;

  }

  async function fetchAccountTypes(){
    accountTypes.value = await window.electronAPI.getAccountTypes();
  }

  async function addAccount(account: Account): Promise<number|null>{
    return await window.electronAPI.insertAccount(account);
  }

  async function addAccountType(accountType: AccountType): Promise<number|null>{
    const newId = await window.electronAPI.insertAccountType(accountType);
    if (newId != null) {
      accountTypes.value.push({ ...accountType, id: newId });
    }
    return newId;
  }

  async function editAccount(account: Account){
    await window.electronAPI.editAccount(account);
  }

  async function editAccountType(account: AccountType){
    const result = await window.electronAPI.editAccountType(account);

    if (result) {
      const index = accountTypes.value.findIndex((at) => at.id === account.id);
      if (index !== -1) {
        accountTypes.value[index] = result;
      }
    }
  }

  async function removeAccountType(id: number){
    await window.electronAPI.deleteAccountTypeById(id);
    accountTypes.value = accountTypes.value.filter((at) => at.id !== id);
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

  async function addCategory(name: string, colorCode: string, icon: string, type: "income" | "expense" | "both") {
    const newCategory = await window.electronAPI.createCategory(
      name,
      colorCode,
      icon,
      type
    );
    categories.value.push(newCategory);
    return newCategory;
  }

  async function editCategory(
    id: number,
    name: string,
    colorCode: string,
    icon: string,
    type: "income" | "expense" | "both"
  ) {
    const updated = await window.electronAPI.updateCategory(
      id,
      name,
      colorCode,
      icon,
      type
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
  // ACTIONS - Recurring Transactions
  // ============================================

  async function fetchRecurringTransactions() {
    recurringTransactions.value = await window.electronAPI.getRecurringTransactions();
  }

  async function addRecurringTransaction(data: Omit<RecurringTransaction, 'id'>) {
    const newRec = await window.electronAPI.createRecurringTransaction(data);
    if (newRec) {
      await fetchRecurringTransactions();
      // Refresh current transactions and account balances in case catch-up triggered
      await fetchTransactions(currentLedgerMonth.value, selectedYear.value ?? undefined);
      await fetchAccounts();
    }
    return newRec;
  }

  async function editRecurringTransaction(id: number, data: Partial<RecurringTransaction>) {
    const updated = await window.electronAPI.updateRecurringTransaction(id, data);
    if (updated) {
      await fetchRecurringTransactions();
      // Refresh current transactions and account balances in case catch-up triggered
      await fetchTransactions(currentLedgerMonth.value, selectedYear.value ?? undefined);
      await fetchAccounts();
    }
    return updated;
  }

  async function removeRecurringTransaction(id: number) {
    const success = await window.electronAPI.deleteRecurringTransaction(id);
    if (success) {
      recurringTransactions.value = recurringTransactions.value.filter(r => r.id !== id);
    }
    return success;
  }

  async function toggleRecurringTransaction(id: number, isActive: boolean) {
    const success = await window.electronAPI.toggleRecurringTransactionActive(id, isActive);
    if (success) {
      await fetchRecurringTransactions();
      if (isActive) {
        // Refresh in case catch-up triggered on activation
        await fetchTransactions(currentLedgerMonth.value, selectedYear.value ?? undefined);
        await fetchAccounts();
      }
    }
    return success;
  }

  // ============================================
  // ACTIONS - Transactions
  // ============================================

  async function fetchTransactions(ledgerMonth?: LedgerMonth | null, yearOnly?: number) {

    let result = await window.electronAPI.getTransactions(ledgerMonth);

    if (yearOnly && !ledgerMonth) {
      result = result.filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === yearOnly;
      });
    }

    console.log(`[Store] Fetched ${result.length} transactions`);

    transactions.value = result;
  }

  async function fetchRecentTransactions(limit: number) {
    recentTransactions.value = await window.electronAPI.getTransactions(
      null,
      limit
    );
  }

  async function fetchDashboardBreakdown() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    
    const results = await window.electronAPI.searchTransactions({
      fromDate: toIsoDateString(thirtyDaysAgo),
      toDate: toIsoDateString(now)
    });
    
    dashboardBreakdown.value = getExpenseBreakdownForRange('last30Days', results);
    dashboardIncomeBreakdown.value = getIncomeBreakdownForRange('last30Days', results);
  }

  async function addTransaction(transaction: CreateTransactionInput
    
  ) {

    const newTransaction = await window.electronAPI.createTransaction(
      transaction,
    );

    const targetPeriodDate = transaction.date.split("-");
    const targetPeriodMonth = Number(targetPeriodDate.at(1));


    // Refresh Data
    await fetchRecentTransactions(5);
    await fetchDashboardBreakdown();

    // Only update main list if it matches current filter (Global or Specific Period)
    if (!currentLedgerMonth.value || currentLedgerMonth.value.month === targetPeriodMonth) {
        // Add to front if valid
        transactions.value.unshift(newTransaction);
        // Refresh summary
        fetchPeriodSummarySync();
    }

    // Refresh trends
    const yearToRefresh = currentLedgerMonth.value ? currentLedgerMonth.value.year : (selectedYear.value || new Date().getFullYear());
    await fetchMonthlyTrends(yearToRefresh);

    return newTransaction;
  }

  async function editTransaction(
    id: number,
    input: Partial<CreateTransactionInput>
  ) {
    // If date is changing, we MUST ensure the ledgerPeriodId is updated to match
    const updateInput = { ...input };
    
    // Logic for ledgerPeriodId is removed as it's no longer manually managed or required in input

    const updated = await window.electronAPI.updateTransaction(id, updateInput);
    if (updated) {
      const index = transactions.value.findIndex((t) => t.id === id);
      if (index !== -1) {
        // If the date changed such that it moves out of the current view (if period specific),
        // we might want to remove it. But for simplicity, we just update it in place or re-fetch.
        // Re-fetching is safer.
        if (currentLedgerMonth.value) {
            // Check if it still belongs?
            // Easier to just re-fetch the list to be safe
             await fetchTransactions(toRaw(currentLedgerMonth.value));
        } else {
             // Global mode, just update
             transactions.value[index] = updated;
        }
      }

      // Refresh search results if active
      if (isSearching.value) {
        const sIndex = searchResults.value.findIndex((t) => t.id === id);
        if (sIndex !== -1) {
          searchResults.value[sIndex] = updated;
        }
      }

      await fetchRecentTransactions(5); // Update dashboard list
      await fetchDashboardBreakdown();
      await fetchPeriodSummarySync(); // Refresh summary

      // Refresh trends
      const yearToRefresh = currentLedgerMonth.value ? currentLedgerMonth.value.year : (selectedYear.value || new Date().getFullYear());
      await fetchMonthlyTrends(yearToRefresh);
    }
    return updated;
  }

  async function removeTransaction(id: number) {
    const success = await window.electronAPI.deleteTransaction(id);
    if (success) {
      transactions.value = transactions.value.filter((t) => t.id !== id);
      await fetchRecentTransactions(5); // Update dashboard list
      await fetchDashboardBreakdown();
      await fetchPeriodSummarySync(); // Refresh summary

      // Also remove from search results if present
      if (isSearching.value) {
        searchResults.value = searchResults.value.filter((t) => t.id !== id);
      }
      // Refresh trends
      const yearToRefresh = currentLedgerMonth.value ? currentLedgerMonth.value.year : (selectedYear.value || new Date().getFullYear());
      await fetchMonthlyTrends(yearToRefresh);
    }
    return success;
  }

  async function removeTransactions(ids: number[]) {
    try {
      const safeIds = Array.from(ids);
      const success = await window.electronAPI.deleteTransactions(safeIds);
      if (success) {
        const idSet = new Set(safeIds);
        transactions.value = transactions.value.filter((t) => !idSet.has(t.id));
        await fetchRecentTransactions(5); // Update dashboard list
        await fetchDashboardBreakdown();
        await fetchPeriodSummarySync(); // Refresh summary

        // Also remove from search results if present
        if (isSearching.value) {
          searchResults.value = searchResults.value.filter((t) => !idSet.has(t.id));
        }
        // Refresh trends
        const yearToRefresh = currentLedgerMonth.value ? currentLedgerMonth.value.year : (selectedYear.value || new Date().getFullYear());
        await fetchMonthlyTrends(yearToRefresh);
      }
      return success;
    } catch (e) {
      console.error("Error in removeTransactions:", e);
      return false;
    }
  }

  async function bulkEditCategory(ids: number[], categoryId: number | null) {
    try {
      const safeIds = Array.from(ids);
      const success = await window.electronAPI.updateTransactionsCategory(safeIds, categoryId);
      if (success) {
        // Safest to just refetch the list
        if (currentLedgerMonth.value) {
          await fetchTransactions(toRaw(currentLedgerMonth.value));
        } else {
          await fetchTransactions(null, selectedYear.value ?? undefined);
        }
        if (isSearching.value) {
          // Refetch search results if possible, or just force user to search again
          if (transactionFilter.value) {
            await searchTransactions(toRaw(transactionFilter.value));
          }
        }
        await fetchRecentTransactions(5);
        await fetchDashboardBreakdown();
        await fetchPeriodSummarySync();
        // Refresh trends
        const yearToRefresh = currentLedgerMonth.value ? currentLedgerMonth.value.year : (selectedYear.value || new Date().getFullYear());
        await fetchMonthlyTrends(yearToRefresh);
        }
        return success;
        } catch (e) {
        console.error("Error in bulkEditCategory:", e);
        return false;
        }
        }

        async function bulkEditAccount(ids: number[], accountId: number) {
        try {
        const safeIds = Array.from(ids);
        const success = await window.electronAPI.updateTransactionsAccount(safeIds, accountId);
        if (success) {
        // Re-fetch transactions
        if (currentLedgerMonth.value) {
          await fetchTransactions(toRaw(currentLedgerMonth.value));
        } else {
          await fetchTransactions(null, selectedYear.value ?? undefined);
        }
        if (isSearching.value && transactionFilter.value) {
          await searchTransactions(toRaw(transactionFilter.value));
        }
        await fetchRecentTransactions(5);
        await fetchDashboardBreakdown();
        await fetchPeriodSummarySync();
        // Refresh trends
        const yearToRefresh = currentLedgerMonth.value ? currentLedgerMonth.value.year : (selectedYear.value || new Date().getFullYear());
        await fetchMonthlyTrends(yearToRefresh);
        // Re-fetch accounts to update balances
        await fetchAccounts();
        }
        return success;    } catch (e) {
      console.error("Error in bulkEditAccount:", e);
      return false;
    }
  }

  // ============================================
  // ACTIONS - Investments
  // ============================================

  async function fetchInvestmentHoldings(accountId?: number) {
    investmentHoldings.value = await window.electronAPI.getInvestmentHoldings(accountId);
  }

  async function fetchInvestmentTransactions(holdingId: number) {
    investmentTransactions.value = await window.electronAPI.getInvestmentTransactions(holdingId);
  }

  async function fetchInvestmentHistory(accountId: number) {
    investmentHistory.value = await window.electronAPI.getInvestmentHistory(accountId);
  }

  async function addInvestmentHolding(data: Omit<InvestmentHolding, 'id'>) {
    const newHolding = await window.electronAPI.createInvestmentHolding(data);
    if (newHolding) {
      await fetchInvestmentHoldings(data.accountId);
    }
    return newHolding;
  }

  async function editInvestmentHolding(id: number, data: Partial<InvestmentHolding>) {
    const updated = await window.electronAPI.updateInvestmentHolding(id, data);
    if (updated) {
      const index = investmentHoldings.value.findIndex(h => h.id === id);
      if (index !== -1) {
        investmentHoldings.value[index] = updated;
      }
    }
    return updated;
  }

  async function removeInvestmentHolding(id: number) {
    const holding = investmentHoldings.value.find(h => h.id === id);
    const success = await window.electronAPI.deleteInvestmentHolding(id);
    if (success && holding) {
      investmentHoldings.value = investmentHoldings.value.filter(h => h.id !== id);
    }
    return success;
  }

  async function addInvestmentTransaction(data: Omit<InvestmentTransaction, 'id'>) {
    const newTx = await window.electronAPI.createInvestmentTransaction(data);
    if (newTx) {
      // Find the holding to know which account to refresh
      const holding = investmentHoldings.value.find(h => h.id === data.holdingId);
      if (holding) {
        await fetchInvestmentHoldings(holding.accountId);
        await fetchInvestmentTransactions(data.holdingId);
        // Also refresh accounts because investment balance might change
        await fetchAccounts();
      }
    }
    return newTx;
  }

  async function refreshInvestmentPrices() {
    if (investmentHoldings.value.length === 0) return;
    
    const symbols = [...new Set(investmentHoldings.value.map(h => h.symbol))];
    try {
      const quotes = await window.electronAPI.getQuotes(symbols);
      
      for (const quote of quotes) {
        // Update all holdings with this symbol in DB
        const holdingsToUpdate = investmentHoldings.value.filter(h => h.symbol === quote.symbol);
        for (const holding of holdingsToUpdate) {
          await window.electronAPI.updateInvestmentHolding(holding.id, {
            lastPrice: quote.price,
            lastUpdated: quote.updatedAt,
            name: quote.name
          });
        }
      }

      // Refresh store state
      await fetchInvestmentHoldings();
      await fetchAccounts();

      // Record history for each investment account
      const investmentAccounts = accounts.value.filter(a => {
        const type = accountTypes.value.find(at => at.id === a.accountTypeId);
        return type?.classification === 'investment';
      });

      const today = new Date().toISOString().split('T')[0];
      for (const acc of investmentAccounts) {
          await window.electronAPI.createInvestmentHistoryEntry(acc.id, acc.balance || 0, today);
      }

    } catch (e) {
      console.error("[Store] Failed to refresh investment prices:", e);
    }
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
      options.type ||
      options.sortOrder;

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
    transactionFilter.value = null;
  }

  function setTransactionFilter(filter: SearchOptions | null) {
    transactionFilter.value = filter;
  }

  // ============================================
  // ACTIONS - Summary / Dashboard
  // ============================================

  // async function fetchPeriodSummary() {
  //   const periodId = currentPeriod.value?.id || null; // null = Global

  //   const summary = await window.electronAPI.getPeriodSummary(periodId);

  //   periodSummary.value = summary || {
  //     totalIncome: 0,
  //     totalExpenses: 0,
  //     balance: 0,
  //     transactionCount: 0,
  //   };

  //   incomeBreakdown.value = await window.electronAPI.getCategoryBreakdown(
  //     periodId,
  //     "income"
  //   );
  //   expenseBreakdown.value = await window.electronAPI.getCategoryBreakdown(
  //     periodId,
  //     "expense"
  //   );
  // }

  async function fetchMonthlyTrends(year: number) {
    try {
      monthlyTrends.value = await window.electronAPI.getMonthlyTrends(year);
    } catch (e) {
      console.error("[Store] Failed to fetch monthly trends:", e);
      // Don't break the UI, just empty trends
      monthlyTrends.value = [];
    }
  }

  async function fetchRollingMonthlyTrends() {
    try {
      monthlyTrends.value = await window.electronAPI.getRollingMonthlyTrends();
    } catch (e) {
      console.error("[Store] Failed to fetch rolling monthly trends:", e);
      monthlyTrends.value = [];
    }
  }

  async function fetchNetWorthTrend() {
    try {
      netWorthTrends.value = await window.electronAPI.getNetWorthTrend();
    } catch (e) {
      console.error("[Store] Failed to fetch net worth trend:", e);
      netWorthTrends.value = [];
    }
  }

  async function fetchPacingData(
    targetMonthStr: string, // "YYYY-MM"
    comparisonMonthStr: string // "YYYY-MM"
  ) {
      // Parse target Month
      const [yearStr, monthStr] = targetMonthStr.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);

      // --- 1. Blue Line (Series A): Cumulative Spend for Target Month ---
      const dailyData = await window.electronAPI.getDailyTransactionSum(year, month, 'expense');
      
      const daysInMonth = new Date(year, month, 0).getDate();
      const seriesA: DailyTransactionSum[] = [];
      let runningTotal = 0;
      
      for (let d = 1; d <= daysInMonth; d++) {
          const entry = dailyData.find(item => item.day === d);
          if (entry) {
              runningTotal += entry.total;
          }
          
          seriesA.push({ day: d, total: runningTotal });
      }

      // --- 2. Gray Line (Series B): Comparison Month ---
      const seriesB: DailyTransactionSum[] = [];

      const [cYearStr, cMonthStr] = comparisonMonthStr.split('-');
      const cYear = parseInt(cYearStr);
      const cMonth = parseInt(cMonthStr);
      
      const cDailyData = await window.electronAPI.getDailyTransactionSum(cYear, cMonth, 'expense');
      
      const cDaysInMonth = new Date(cYear, cMonth, 0).getDate();
      
      let cRunningTotal = 0;
      // We map up to the max days of either month to ensure the chart covers the longer month
      const maxDays = Math.max(daysInMonth, cDaysInMonth);
      
      for (let d = 1; d <= maxDays; d++) {
          const entry = cDailyData.find(item => item.day === d);
          if (entry) {
              cRunningTotal += entry.total;
          }
          seriesB.push({ day: d, total: cRunningTotal });
      }

      return { seriesA, seriesB };
  }

  // ==================================
  // SETTINGS ACTIONS
  // ==================================

  async function importDatabaseData(data: ImportData, skipDuplicates: boolean = false, isReplace: boolean = false): Promise<boolean> {

    const importAccounts = data.accounts!;
    const importTransactions = data.transactions!;
    const importCategories = data.categories!;
    const importAccountTypes = data.accountTypes!;
    const importLedgerYears = data.ledgerYears!;
    const importRecurringTransactions = data.recurringTransactions || [];
    const importInvestmentHoldings = data.investmentHoldings || [];
    const importInvestmentTransactions = data.investmentTransactions || [];
    const importInvestmentHistory = data.investmentHistory || [];

    const accountTypeIdMap = new Map<number, number>();
    const categoryTypeIdMap = new Map<number, number>();
    const accountIdMap = new Map<number, number>();
    const recurringIdMap = new Map<number, number>();
    const holdingIdMap = new Map<number, number>();

    try {
      for (const accountType of importAccountTypes){

        if (!isReplace) {
          // Check for existing account type
          const existing = accountTypes.value.find((at) => at.type === accountType.type);
          if (existing){
            accountTypeIdMap.set(accountType.id, existing.id);
            console.log(`Skipping inserting existing account type ${accountType.type}`);
            continue;
          }
        }
    
        const result = await addAccountType(accountType);

        console.log(`Inserting account type ${accountType.type} resulted in id ${result}`);
    
        if (result == null){
          throw new Error("Resulting Id from inserting of account type is null");
        }
    
        accountTypeIdMap.set(accountType.id, result);
      }
    
      for (const account of importAccounts){

        if (!isReplace) {
          // Check for existing account
          const existing = accounts.value.find((a) => a.accountName === account.accountName && a.institutionName === account.institutionName);
          if (existing){
            accountIdMap.set(account.id, existing.id);
            console.log(`Skipping inserting existing account ${account.accountName}`);
            continue;
          }
        }
    
        const accountTypeId = accountTypeIdMap.get(account.accountTypeId);
    
        if (accountTypeId == undefined){
          throw new Error("Account type id mapping not found for account id: " + account.id);
        }
    
        account.accountTypeId = accountTypeId;
    
        const result = await addAccount(account);

        console.log(`Inserting account ${account.accountName} resulted in id ${result}`);
    
        if (result == null){
          throw new Error("Resulting Id from inserting of account is null");
        }
    
        accountIdMap.set(account.id, result);
    
      }
    
      for (const category of importCategories){

        if (!isReplace) {
          // Check for existing category
          const existing = categories.value.find((c) => c.name === category.name);
          if (existing){
            categoryTypeIdMap.set(category.id, existing.id);
            console.log(`Skipping inserting existing category ${category.name}`);
            continue;
          }
        }
    
        const result = await addCategory(
          category.name, 
          category.colorCode, 
          category.icon, 
          category.type || "expense"
        );

        console.log(`Inserting category ${category.name} resulted in id ${result.id}`);
    
        if (result == null){
          throw new Error("Resulting Id from inserting of category is null");
        }
    
        categoryTypeIdMap.set(category.id, result.id);
    
      }
    
      for (const ledgerYear of importLedgerYears){

        if (!isReplace) {
          // Check for existing ledger year
          const existing = ledgerYears.value.find((ly) => ly === ledgerYear);
          if (existing){
            console.log(`Skipping inserting existing ledger year ${ledgerYear}`);
            continue;
          }
        }
    
        await createYear(ledgerYear);

        console.log(`Inserting ledger year ${ledgerYear} completed`);
      }
    
      for (const recurring of importRecurringTransactions) {
        if (!isReplace) {
          // Check for existing recurring transaction
          const existing = recurringTransactions.value.find((r) => 
            r.title === recurring.title && r.amount === recurring.amount && r.frequency === recurring.frequency
          );
          
          if (existing) {
            recurringIdMap.set(recurring.id, existing.id);
            console.log(`Skipping inserting existing recurring transaction ${recurring.title}`);
            continue;
          }
        }

        if (recurring.categoryId != undefined) {
          const mappedCategoryId = categoryTypeIdMap.get(recurring.categoryId);
          if (mappedCategoryId == undefined) {
            throw new Error("Category id mapping not found for recurring transaction id: " + recurring.id);
          }
          recurring.categoryId = mappedCategoryId;
        }

        const mappedAccountId = accountIdMap.get(recurring.accountId);
        if (mappedAccountId == undefined) {
          throw new Error("Account id mapping not found for recurring transaction id: " + recurring.id);
        }
        recurring.accountId = mappedAccountId;

        if (recurring.transferAccountId != undefined) {
          const mappedTransferAccountId = accountIdMap.get(recurring.transferAccountId);
          if (mappedTransferAccountId == undefined) {
            throw new Error("Transfer Account id mapping not found for recurring transaction id: " + recurring.id);
          }
          recurring.transferAccountId = mappedTransferAccountId;
        }

        const result = await addRecurringTransaction({
          title: recurring.title,
          amount: recurring.amount,
          type: recurring.type,
          categoryId: recurring.categoryId ?? null,
          accountId: recurring.accountId,
          transferAccountId: recurring.transferAccountId ?? null,
          frequency: recurring.frequency,
          startDate: recurring.startDate,
          nextRunDate: recurring.nextRunDate,
          isActive: recurring.isActive,
          isExpenseTransfer: recurring.isExpenseTransfer,
        });

        console.log(`Inserting recurring transaction ${recurring.title} completed`);
        
        if (result == null) {
          throw new Error("Resulting Id from inserting of recurring transaction is null");
        }
        recurringIdMap.set(recurring.id, result.id);
      }

      for (const transaction of importTransactions){

          if (!isReplace && skipDuplicates){
            // Check for existing transaction
            const existing = transactions.value.find((t) => t.title === transaction.title && t.amount === transaction.amount && t.date === transaction.date);
            if (existing){
              console.log(`Skipping inserting existing transaction ${transaction.title}`);
              continue;
            }
          }
    
          if (transaction.categoryId != undefined){
            const mappedCategoryId = categoryTypeIdMap.get(transaction.categoryId);
    
            if (mappedCategoryId == undefined){
              throw new Error("Category id mapping not found for transaction id: " + transaction.id);
            }
    
            transaction.categoryId = mappedCategoryId;
          }
    
          const mappedAccountId = accountIdMap.get(transaction.accountId);
    
          if (mappedAccountId == undefined){
            throw new Error("Account id mapping not found for transaction id: " + transaction.id);
          }
    
          transaction.accountId = mappedAccountId;

          if (transaction.transferAccountId != undefined) {
            const mappedTransferAccountId = accountIdMap.get(transaction.transferAccountId);
            if (mappedTransferAccountId == undefined) {
              throw new Error("Transfer Account id mapping not found for transaction id: " + transaction.id);
            }
            transaction.transferAccountId = mappedTransferAccountId;
          }
          
          if (transaction.recurringId != undefined) {
            const mappedRecurringId = recurringIdMap.get(transaction.recurringId);
            if (mappedRecurringId != undefined) {
              transaction.recurringId = mappedRecurringId;
            } else {
              // If we didn't find the recurring mapping, it might be an orphaned link.
              // We set it to undefined to avoid foreign key failure.
              transaction.recurringId = undefined;
            }
          }

          await addTransaction({
            title: transaction.title,
            amount: transaction.amount,
            date: transaction.date,
            type: transaction.type,
            categoryId: transaction.categoryId ?? undefined,
            accountId: transaction.accountId!,
            transferAccountId: transaction.transferAccountId ?? undefined,
            recurringId: transaction.recurringId ?? undefined,
            notes: transaction.notes || undefined,
            isExpenseTransfer: transaction.isExpenseTransfer,
            isIncomeTransfer: transaction.isIncomeTransfer,
          });
          console.log(`Inserting transaction ${transaction.title} completed`);
      }

      for (const holding of importInvestmentHoldings) {
        if (!isReplace && skipDuplicates) {
          const mappedAccountId = accountIdMap.get(holding.accountId);
          const existing = investmentHoldings.value.find(h => h.accountId === mappedAccountId && h.symbol === holding.symbol);
          if (existing) {
            holdingIdMap.set(holding.id, existing.id);
            console.log(`Skipping inserting existing holding ${holding.symbol}`);
            continue;
          }
        }

        const mappedAccountId = accountIdMap.get(holding.accountId);
        if (mappedAccountId == undefined) {
          throw new Error("Account id mapping not found for holding id: " + holding.id);
        }

        const result = await addInvestmentHolding({
          accountId: mappedAccountId,
          symbol: holding.symbol,
          name: holding.name,
          quantity: holding.quantity,
          lastPrice: holding.lastPrice,
          lastUpdated: holding.lastUpdated
        });

        console.log(`Inserting holding ${holding.symbol} completed`);
        if (result == null) {
          throw new Error("Resulting Id from inserting holding is null");
        }
        holdingIdMap.set(holding.id, result.id);
      }

      for (const tx of importInvestmentTransactions) {
        if (!isReplace && skipDuplicates) {
          const mappedHoldingId = holdingIdMap.get(tx.holdingId);
          const existing = investmentTransactions.value.find(t => 
            t.holdingId === mappedHoldingId && t.date === tx.date && t.type === tx.type && t.quantity === tx.quantity
          );
          if (existing) {
            console.log(`Skipping inserting existing investment transaction`);
            continue;
          }
        }

        const mappedHoldingId = holdingIdMap.get(tx.holdingId);
        if (mappedHoldingId == undefined) {
          throw new Error("Holding id mapping not found for investment transaction id: " + tx.id);
        }

        await addInvestmentTransaction({
          holdingId: mappedHoldingId,
          date: tx.date,
          type: tx.type,
          quantity: tx.quantity,
          price: tx.price,
          fees: tx.fees
        });
      }

      // Reset holding quantities to their exported values since adding transactions artificially inflates them
      for (const holding of importInvestmentHoldings) {
        const mappedHoldingId = holdingIdMap.get(holding.id);
        if (mappedHoldingId !== undefined) {
          await window.electronAPI.updateInvestmentHolding(mappedHoldingId, {
            quantity: holding.quantity
          });
        }
      }

      for (const hist of importInvestmentHistory) {
        if (!isReplace && skipDuplicates) {
          const mappedAccountId = accountIdMap.get(hist.accountId);
          const existing = investmentHistory.value.find(h => 
            h.accountId === mappedAccountId && h.date === hist.date && h.totalValue === hist.totalValue
          );
          if (existing) {
            console.log(`Skipping inserting existing investment history`);
            continue;
          }
        }

        const mappedAccountId = accountIdMap.get(hist.accountId);
        if (mappedAccountId == undefined) {
          throw new Error("Account id mapping not found for investment history id: " + hist.id);
        }

        await window.electronAPI.createInvestmentHistoryEntry(
          mappedAccountId,
          hist.totalValue,
          hist.date
        );
      }

      const importInvestmentAdjustments = data.investmentAdjustments || [];
      for (const adj of importInvestmentAdjustments) {
        if (!isReplace && skipDuplicates) {
          const mappedAccountId = accountIdMap.get(adj.accountId);
          const existing = (await window.electronAPI.getInvestmentAdjustments(mappedAccountId)).find(a => 
            a.date === adj.date && a.amount === adj.amount && a.type === adj.type && a.notes === adj.notes
          );
          if (existing) {
            console.log(`Skipping inserting existing investment adjustment`);
            continue;
          }
        }

        const mappedAccountId = accountIdMap.get(adj.accountId);
        if (mappedAccountId == undefined) {
          throw new Error("Account id mapping not found for investment adjustment id: " + adj.id);
        }

        await window.electronAPI.adjustAccountCash(
          mappedAccountId,
          adj.type === 'expense' ? -adj.amount : adj.amount,
          adj.notes
        );
      }

    }
   catch (error) {
      console.log(error);
      return false;
    }

    return true;
  }

  async function deleteAllDataFromTables(){
    await window.electronAPI.deleteAllDataFromTables();
    accounts.value = [];
    categories.value = [];
    transactions.value = [];
    accountTypes.value = [];
    ledgerMonths.value = [];
    ledgerYears.value = [];
    investmentHoldings.value = [];
    investmentTransactions.value = [];
    investmentHistory.value = [];
  }

  // ============================================
  // RETURN STORE 
  // ============================================

  return {
    // State
    currentLedgerMonth,
    selectedYear,
    ledgerYears,
    ledgerMonths,
    categories,
    accounts,
    accountTypes,
    transactions,
    recentTransactions,
    recurringTransactions,
    searchResults,
    isSearching,
    transactionFilter,
    databaseVersion,
    periodSummary,
    incomeBreakdown,
    expenseBreakdown,
    dashboardBreakdown,
    dashboardIncomeBreakdown,
    monthlyTrends,
    netWorthTrends,
    expandedAccountSections,
    expandedInvestmentAccounts,
    investmentHoldings,
    investmentTransactions,
    investmentHistory,
    refreshCooldown,
    startRefreshCooldown,
    isLoading,
    isChangingPeriod,
    error,

    // Getters
    hasCurrentPeriod,
    incomeTransactions,
    expenseTransactions,
    transferTransactions,

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
    fetchRecurringTransactions,
    addRecurringTransaction,
    editRecurringTransaction,
    removeRecurringTransaction,
    toggleRecurringTransaction,
    fetchTransactions,
    fetchRecentTransactions,
    fetchDashboardBreakdown,
    fetchPeriodSummarySync,
    fetchMonthlyTrends,
    fetchRollingMonthlyTrends,
    fetchNetWorthTrend,
    fetchPacingData,
    fetchInvestmentHoldings,
    fetchInvestmentTransactions,
    fetchInvestmentHistory,
    addInvestmentHolding,
    editInvestmentHolding,
    removeInvestmentHolding,
    addInvestmentTransaction,
    refreshInvestmentPrices,
    addTransaction,
    editTransaction,
    removeTransaction,
    removeTransactions,
    bulkEditCategory,
    bulkEditAccount,
    searchTransactions,
    clearSearch,
    setTransactionFilter,
    fetchAccounts,
    fetchAccountTypes,
    removeAccount,
    addAccount,
    addAccountType,
    editAccount,
    editAccountType,
    removeAccountType,
    deleteAllDataFromTables,
    importDatabaseData,
  };
});
