import { ipcMain, shell } from "electron";
import fs from "node:fs";
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
  // Transactions
  getTransactions,
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
  closeDb,
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
} from "./db";
import { Account, AccountType, CreateTransactionInput, LedgerMonth, SearchOptions, RecurringTransaction } from "@/types";

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
  // TRANSACTIONS HANDLERS
  // ============================================

  ipcMain.handle(
    "db:getTransactions",
    async (_event, ledgerMonth?: LedgerMonth, limit?: number) => {
      return getTransactions(ledgerMonth, limit);
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

  ipcMain.handle("system:deleteDatabase", async () => {
    try {
      // Close the database connection first
      closeDb();

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

  console.log("[IPC] All database handlers registered");
}
