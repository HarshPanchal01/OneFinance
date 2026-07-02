import { ipcMain, shell } from "electron";
import fs from "node:fs";
import { loadSettings, saveSettings, runBackup, getLatestManualBackup, BackupSettings } from "./backup";
import { clearSecurity } from "./security";
import {
  // Ledger Years
  getLedgerYears,
  createLedgerYear,
  deleteLedgerYear,

  // Categories
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getBudgets,
  upsertBudget,
  deleteBudget,
  getSavingsGoals,
  upsertSavingsGoal,
  deleteSavingsGoal,
  // Transactions
  getTransactions,
  getAllTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  deleteTransactions,
  updateTransactionsCategory,
  updateTransactionsAccount,
  searchTransactions,
  getMonthlyTrends,
  getDailyTransactionSum,

  // Types

  // DB paths and instance
  getDbPath,
  lockDatabase,
  getAccounts,
  getAccountTypes,
  deleteAccountById,
  insertAccount,
  editAccount,
  insertAccountType,
  deleteAllDataFromTables,
  getRollingMonthlyTrends,
  getTotalMonthSpend,
  getNetWorthTrend,
  getDatabaseVersion,
  deleteAccountTypeById,
  editAccountType,

  // Recurring Transactions
  getRecurringTransactions,
  createRecurringTransaction,
  updateRecurringTransaction,
  deleteRecurringTransaction,
  toggleRecurringTransactionActive,

  // Investment Functions
  getInvestmentHoldings,
  createInvestmentHolding,
  updateInvestmentHolding,
  deleteInvestmentHolding,
  getInvestmentTransactions,
  getAllInvestmentTransactions,
  getAccountInvestmentTransactions,
  getCombinedInvestmentHistory,
  getAllCombinedInvestmentHistory,
  getInvestmentAdjustments,
  getCombinedCashHistory,
  getAccountTransactions,
  createInvestmentTransaction,
  adjustAccountCash,
  getInvestmentHistory,
  getGlobalInvestmentHistory,
  replaceInvestmentHistory,
  bulkUpsertInvestmentHistory,
  createInvestmentHistoryEntry,
} from "./db";
import { getQuote, getQuotes, searchSymbols, getAssetProfile, getHistoricalPrices } from "./finance";
import { Account, AccountType, CreateTransactionInput, LedgerMonth, SearchOptions, RecurringTransaction, InvestmentHolding, InvestmentTransaction, SavingsGoal } from "@/types";

/**
 * Register all IPC handlers for database operations
 * Call this once in main.ts after app is ready
 */
export function registerIpcHandlers(): void {
  // ============================================
  // LEDGER YEARS HANDLERS
  // ============================================

  ipcMain.handle("db:getLedgerYears", async () => {
    return getLedgerYears();
  });

  ipcMain.handle("db:createLedgerYear", async (_event, year: number) => {
    return createLedgerYear(year);
  });


  ipcMain.handle("db:deleteLedgerYear", async (_event, year: number, deleteTransactions: boolean) => {
    return deleteLedgerYear(year, deleteTransactions);
  });

  // ============================================
  // ACCOUNTS HANDLERS
  // ============================================

  ipcMain.handle("db:getAccounts", async () =>{
    return getAccounts();
  });

  ipcMain.handle("db:getAccountTypes", async () =>{
    return getAccountTypes();
  });

  ipcMain.handle("db:deleteAccountById", async (_event, id: number, strategy: 'transfer' | 'delete', transferToAccountId?: number) =>{
    return deleteAccountById(id, strategy, transferToAccountId);
  });

  ipcMain.handle("db:deleteAccountTypeById", async (_event, id: number) =>{
    return deleteAccountTypeById(id);
  });

  ipcMain.handle("db:insertAccount", async (_event, account: Account) => {
    return insertAccount(account);
  });

  ipcMain.handle("db:insertAccountType", async (_event, accountType: AccountType) => {
    return insertAccountType(accountType);
  });

  ipcMain.handle("db:editAccount", async (_event, account: Account) => {
    return editAccount(account);
  });

  ipcMain.handle("db:editAccountType", async (_event, accountType: AccountType) => {
    return editAccountType(accountType);
  });

  // ============================================
  // CATEGORIES HANDLERS
  // ============================================

  ipcMain.handle("db:getCategories", async () => {
    return getCategories();
  });

  ipcMain.handle("db:getCategoryById", async (_event, id: number) => {
    return getCategoryById(id);
  });

  ipcMain.handle(
    "db:createCategory",
    async (_event, name: string, colorCode: string, icon: string, type: "income" | "expense") => {
      return createCategory(name, colorCode, icon, type);
    }
  );

  ipcMain.handle(
    "db:updateCategory",
    async (
      _event,
      id: number,
      name: string,
      colorCode: string,
      icon: string,
      type: "income" | "expense" | "both"
    ) => {
      return updateCategory(id, name, colorCode, icon, type);
    }
  );

  ipcMain.handle("db:deleteCategory", async (_event, id: number) => {
    return deleteCategory(id);
  });

  // ============================================
  // BUDGETS HANDLERS
  // ============================================

  ipcMain.handle("db:getBudgets", async () => {
    return getBudgets();
  });

  ipcMain.handle("db:upsertBudget", async (_event, categoryId: number, amount: number, period: string) => {
    return upsertBudget(categoryId, amount, period);
  });

  ipcMain.handle("db:deleteBudget", async (_event, categoryId: number) => {
    return deleteBudget(categoryId);
  });

  ipcMain.handle("db:getSavingsGoals", async () => {
    return getSavingsGoals();
  });

  ipcMain.handle("db:upsertSavingsGoal", async (_event, goal: Omit<SavingsGoal, "id"> & { id?: number }) => {
    return upsertSavingsGoal(goal);
  });

  ipcMain.handle("db:deleteSavingsGoal", async (_event, id: number) => {
    return deleteSavingsGoal(id);
  });

  // ============================================
  // TRANSACTIONS HANDLERS
  // ============================================

  ipcMain.handle(
    "db:getTransactions",
    async (_event, ledgerMonth?: LedgerMonth, limit?: number) => {
      return getTransactions(ledgerMonth, limit);
    }
  );

  ipcMain.handle(
    "db:getAllTransactions",
    async () => {
      return getAllTransactions();
    }
  );

  ipcMain.handle("db:getTransactionById", async (_event, id: number) => {
    return getTransactionById(id);
  });

  ipcMain.handle(
    "db:createTransaction",
    async (_event, input: CreateTransactionInput) => {
      return createTransaction(input);
    }
  );

  ipcMain.handle(
    "db:updateTransaction",
    async (_event, id: number, input: Partial<CreateTransactionInput>) => {
      return updateTransaction(id, input);
    }
  );

  ipcMain.handle("db:deleteTransaction", async (_event, id: number) => {
    return deleteTransaction(id);
  });

  ipcMain.handle("db:deleteTransactions", async (_event, ids: number[]) => {
    return deleteTransactions(ids);
  });

  ipcMain.handle("db:updateTransactionsCategory", async (_event, ids: number[], categoryId: number | null) => {
    return updateTransactionsCategory(ids, categoryId);
  });

  ipcMain.handle("db:updateTransactionsAccount", async (_event, ids: number[], accountId: number) => {
    return updateTransactionsAccount(ids, accountId);
  });

  ipcMain.handle(
    "db:searchTransactions",
    async (_event, options: SearchOptions, limit?: number) => {
      return searchTransactions(options, limit);
    }
  );

  ipcMain.handle("db:getMonthlyTrends", async (_event, year: number) => {
    return getMonthlyTrends(year);
  });

  ipcMain.handle("db:getRollingMonthlyTrends", async () => {
    return getRollingMonthlyTrends();
  });

  ipcMain.handle("db:getDailyTransactionSum", async (_event, year: number, month: number, type: 'income' | 'expense') => {
    return getDailyTransactionSum(year, month, type);
  });

  ipcMain.handle("db:getTotalMonthSpend", async (_event, year: number, month: number) => {
    return getTotalMonthSpend(year, month);
  });

  ipcMain.handle("db:getNetWorthTrend", async () => {
    return getNetWorthTrend();
  });

  ipcMain.handle("db:getDatabaseVersion", async () => {
    return getDatabaseVersion();
  });





  // ============================================
  // RECURRING TRANSACTIONS HANDLERS
  // ============================================

  ipcMain.handle("db:getRecurringTransactions", async () => {
    return getRecurringTransactions();
  });

  ipcMain.handle("db:createRecurringTransaction", async (_event, data: Omit<RecurringTransaction, 'id'>) => {
    return createRecurringTransaction(data);
  });

  ipcMain.handle("db:updateRecurringTransaction", async (_event, id: number, data: Partial<RecurringTransaction>) => {
    return updateRecurringTransaction(id, data);
  });

  ipcMain.handle("db:deleteRecurringTransaction", async (_event, id: number) => {
    return deleteRecurringTransaction(id);
  });

  ipcMain.handle("db:toggleRecurringTransactionActive", async (_event, id: number, isActive: boolean) => {
    return toggleRecurringTransactionActive(id, isActive);
  });

  // ============================================
  // INVESTMENT HANDLERS
  // ============================================

  ipcMain.handle("db:getInvestmentHoldings", async (_event, accountId?: number) => {
    return getInvestmentHoldings(accountId);
  });

  ipcMain.handle("db:createInvestmentHolding", async (_event, data: Omit<InvestmentHolding, 'id'>) => {
    return createInvestmentHolding(data);
  });

  ipcMain.handle("db:updateInvestmentHolding", async (_event, id: number, data: Partial<InvestmentHolding>) => {
    return updateInvestmentHolding(id, data);
  });

  ipcMain.handle("db:deleteInvestmentHolding", async (_event, id: number) => {
    return deleteInvestmentHolding(id);
  });

  ipcMain.handle("db:getInvestmentTransactions", async (_event, holdingId: number) => {
    return getInvestmentTransactions(holdingId);
  });

  ipcMain.handle("db:getAllInvestmentTransactions", async () => {
    return getAllInvestmentTransactions();
  });

  ipcMain.handle("db:getAccountInvestmentTransactions", async (_event, accountId: number) => {
    return getAccountInvestmentTransactions(accountId);
  });

  ipcMain.handle("db:getCombinedInvestmentHistory", async (_event, accountId: number) => {
    return getCombinedInvestmentHistory(accountId);
  });

  ipcMain.handle("db:getAllCombinedInvestmentHistory", async () => {
    return getAllCombinedInvestmentHistory();
  });

  ipcMain.handle("db:getInvestmentAdjustments", async (_event, accountId?: number) => {
    return getInvestmentAdjustments(accountId);
  });

  ipcMain.handle("db:getCombinedCashHistory", async (_event, accountId: number) => {
    return getCombinedCashHistory(accountId);
  });

  ipcMain.handle("db:getAccountTransactions", async (_event, accountId: number) => {
    return getAccountTransactions(accountId);
  });

  ipcMain.handle("db:createInvestmentTransaction", async (_event, data: Omit<InvestmentTransaction, 'id'>) => {
    return createInvestmentTransaction(data);
  });

  ipcMain.handle("db:adjustAccountCash", async (_event, accountId: number, amount: number, notes: string) => {
    return adjustAccountCash(accountId, amount, notes);
  });

  ipcMain.handle("db:getInvestmentHistory", async (_event, accountId: number) => {
    return getInvestmentHistory(accountId);
  });

  ipcMain.handle("db:replaceInvestmentHistory", async (_event, accountId: number, histories: {date: string, totalValue: number}[]) => {
    return replaceInvestmentHistory(accountId, histories);
  });

  ipcMain.handle("db:bulkUpsertInvestmentHistory", async (_event, accountId: number, histories: {date: string, totalValue: number}[]) => {
    return bulkUpsertInvestmentHistory(accountId, histories);
  });

  ipcMain.handle("db:getGlobalInvestmentHistory", async () => {
    return getGlobalInvestmentHistory();
  });

  ipcMain.handle("db:createInvestmentHistoryEntry", async (_event, accountId: number, totalValue: number, date: string) => {
    return createInvestmentHistoryEntry(accountId, totalValue, date);
  });

  // ============================================
  // FINANCE HANDLERS
  // ============================================

  ipcMain.handle("finance:getQuote", async (_event, symbol: string) => {
    return getQuote(symbol);
  });

  ipcMain.handle("finance:getQuotes", async (_event, symbols: string[]) => {
    return getQuotes(symbols);
  });

  ipcMain.handle("finance:searchSymbols", async (_event, query: string) => {
    return searchSymbols(query);
  });

  ipcMain.handle("finance:getAssetProfile", async (_event, symbol: string) => {
    return getAssetProfile(symbol);
  });

  ipcMain.handle("finance:getHistoricalPrices", async (_event, symbol: string, period1: string, period2: string) => {
    return getHistoricalPrices(symbol, period1, period2);
  });

  // ============================================
  // SYSTEM HANDLERS
  // ============================================

  ipcMain.handle("db:deleteAllDataFromTables", async () => {
    return deleteAllDataFromTables();
  });

  ipcMain.handle("system:getPlatform", async () => {
    return process.platform;
  });

  ipcMain.handle("system:getDbPath", async () => {
    return getDbPath();
  });

  ipcMain.handle("system:openDbLocation", async () => {
    shell.showItemInFolder(getDbPath());
  });

  ipcMain.handle("system:openExternal", async (_event, url: string) => {
    return shell.openExternal(url);
  });

  ipcMain.handle("system:deleteDatabase", async () => {
    try {
      // Lock + close the connection, then forget the stored verifier so the next
      // launch starts fresh at the create-password screen.
      lockDatabase();
      clearSecurity();

      // Delete the database file and related files
      const dbPath = getDbPath();
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }
      if (fs.existsSync(dbPath + "-wal")) {
        fs.unlinkSync(dbPath + "-wal");
      }
      if (fs.existsSync(dbPath + "-shm")) {
        fs.unlinkSync(dbPath + "-shm");
      }

      console.log("[IPC] Database deleted.");
      return true;
    } catch (error) {
      console.error("[IPC] Failed to delete database:", error);
      return false;
    }
  });

  // ============================================
  // AUTOMATED BACKUP HANDLERS
  // ============================================

  ipcMain.handle("backup:getSettings", async () => {
    return loadSettings();
  });

  ipcMain.handle("backup:saveSettings", async (_event, partial: Partial<BackupSettings>) => {
    return saveSettings(partial);
  });

  ipcMain.handle("backup:runNow", async (_event, type: 'auto' | 'manual', override: boolean) => {
    return runBackup(type, override);
  });

  ipcMain.handle("backup:getLatestManualBackup", async () => {
    const settings = loadSettings();
    if (!settings.folder) return { exists: false, filename: null };
    return getLatestManualBackup(settings.folder);
  });

  console.log("[IPC] All database handlers registered");
}
