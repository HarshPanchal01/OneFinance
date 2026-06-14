import { Account, AccountType, Category, CreateTransactionInput, LedgerMonth, SearchOptions, TransactionWithCategory, MonthlyTrend, DailyTransactionSum, RecurringTransaction, InvestmentHolding, InvestmentTransaction, InvestmentHistory, PriceAlert } from "@/types";
import type { BackupSettings } from "./backup";
import type { AppPreferences } from "./preferences";
import { ipcRenderer, contextBridge } from "electron";

// The API exposed to the renderer process
const electronAPI = {
  // ============================================
  // INVESTMENT
  // ============================================

  getInvestmentHoldings: (accountId?: number): Promise<InvestmentHolding[]> =>
    ipcRenderer.invoke("db:getInvestmentHoldings", accountId),

  createInvestmentHolding: (data: Omit<InvestmentHolding, 'id'>): Promise<InvestmentHolding> =>
    ipcRenderer.invoke("db:createInvestmentHolding", data),

  updateInvestmentHolding: (id: number, data: Partial<InvestmentHolding>): Promise<InvestmentHolding> =>
    ipcRenderer.invoke("db:updateInvestmentHolding", id, data),

  deleteInvestmentHolding: (id: number): Promise<boolean> =>
    ipcRenderer.invoke("db:deleteInvestmentHolding", id),

  getInvestmentTransactions: (holdingId: number): Promise<InvestmentTransaction[]> =>
    ipcRenderer.invoke("db:getInvestmentTransactions", holdingId),
  getAllInvestmentTransactions: (): Promise<InvestmentTransaction[]> =>
    ipcRenderer.invoke("db:getAllInvestmentTransactions"),
  getAccountInvestmentTransactions: (accountId: number): Promise<InvestmentTransaction[]> =>
    ipcRenderer.invoke("db:getAccountInvestmentTransactions", accountId),
  getCombinedInvestmentHistory: (accountId: number): Promise<any[]> =>
    ipcRenderer.invoke("db:getCombinedInvestmentHistory", accountId),
  getAllCombinedInvestmentHistory: (): Promise<any[]> =>
    ipcRenderer.invoke("db:getAllCombinedInvestmentHistory"),
  getInvestmentAdjustments: (accountId?: number): Promise<any[]> =>
    ipcRenderer.invoke("db:getInvestmentAdjustments", accountId),
  getCombinedCashHistory: (accountId: number): Promise<any[]> =>
    ipcRenderer.invoke("db:getCombinedCashHistory", accountId),
  getAccountTransactions: (accountId: number): Promise<TransactionWithCategory[]> =>
    ipcRenderer.invoke("db:getAccountTransactions", accountId),

  createInvestmentTransaction: (data: Omit<InvestmentTransaction, 'id'>): Promise<InvestmentTransaction> =>
    ipcRenderer.invoke("db:createInvestmentTransaction", data),

  adjustAccountCash: (accountId: number, amount: number, notes: string): Promise<any> =>
    ipcRenderer.invoke("db:adjustAccountCash", accountId, amount, notes),

  getInvestmentHistory: (accountId: number): Promise<InvestmentHistory[]> =>
    ipcRenderer.invoke("db:getInvestmentHistory", accountId),
  getGlobalInvestmentHistory: (): Promise<InvestmentHistory[]> =>
    ipcRenderer.invoke("db:getGlobalInvestmentHistory"),
  replaceInvestmentHistory: (accountId: number, histories: {date: string, totalValue: number}[]): Promise<void> =>
    ipcRenderer.invoke("db:replaceInvestmentHistory", accountId, histories),
  bulkUpsertInvestmentHistory: (accountId: number, histories: {date: string, totalValue: number}[]): Promise<void> =>
    ipcRenderer.invoke("db:bulkUpsertInvestmentHistory", accountId, histories),
  createInvestmentHistoryEntry: (accountId: number, totalValue: number, date: string): Promise<InvestmentHistory> =>
    ipcRenderer.invoke("db:createInvestmentHistoryEntry", accountId, totalValue, date),

  // ============================================
  // FINANCE
  // ============================================

  getQuote: (symbol: string): Promise<any> =>
    ipcRenderer.invoke("finance:getQuote", symbol),

  getQuotes: (symbols: string[]): Promise<any[]> =>
    ipcRenderer.invoke("finance:getQuotes", symbols),

  searchSymbols: (query: string): Promise<any[]> =>
    ipcRenderer.invoke("finance:searchSymbols", query),

  getAssetProfile: (symbol: string): Promise<string | null> =>
    ipcRenderer.invoke("finance:getAssetProfile", symbol),

  getHistoricalPrices: (symbol: string, period1: string, period2: string): Promise<{ date: string; close: number }[]> =>
    ipcRenderer.invoke("finance:getHistoricalPrices", symbol, period1, period2),

  // ============================================
  // RECURRING TRANSACTIONS
  // ============================================

  getRecurringTransactions: (): Promise<RecurringTransaction[]> =>
    ipcRenderer.invoke("db:getRecurringTransactions"),

  createRecurringTransaction: (data: Omit<RecurringTransaction, 'id'>): Promise<RecurringTransaction> =>
    ipcRenderer.invoke("db:createRecurringTransaction", data),

  updateRecurringTransaction: (id: number, data: Partial<RecurringTransaction>): Promise<RecurringTransaction> =>
    ipcRenderer.invoke("db:updateRecurringTransaction", id, data),

  deleteRecurringTransaction: (id: number): Promise<boolean> =>
    ipcRenderer.invoke("db:deleteRecurringTransaction", id),

  toggleRecurringTransactionActive: (id: number, isActive: boolean): Promise<boolean> =>
    ipcRenderer.invoke("db:toggleRecurringTransactionActive", id, isActive),

  onRecurringProcessed: (callback: () => void) => {
    ipcRenderer.on("recurring-processed", callback);
  },

  onSavingsInterestProcessed: (callback: () => void) => {
    ipcRenderer.on("savings-interest-processed", callback);
  },

  onReminderNotified: (callback: () => void) => {
    ipcRenderer.on("reminder-notified", callback);
  },

  onNavigateReminders: (callback: () => void) => {
    ipcRenderer.on("navigate-reminders", callback);
  },

  setReminderLocale: (locale: string, currency: string): Promise<void> =>
    ipcRenderer.invoke("reminders:setLocale", locale, currency),

  showPriceAlerts: (alerts: PriceAlert[]): Promise<void> =>
    ipcRenderer.invoke("notifications:showPriceAlerts", alerts),

  onNavigateInvestments: (callback: () => void) => {
    ipcRenderer.on("navigate-investments", callback);
  },

  // ============================================
  // APP PREFERENCES (tray / launch on login)
  // ============================================

  getAppPreferences: (): Promise<AppPreferences> =>
    ipcRenderer.invoke("prefs:get"),

  saveAppPreferences: (partial: Partial<AppPreferences>): Promise<AppPreferences> =>
    ipcRenderer.invoke("prefs:set", partial),

  // ============================================
  // LEDGER YEARS
  // ============================================
  getLedgerYears: (): Promise<number[]> =>
    ipcRenderer.invoke("db:getLedgerYears"),

  createLedgerYear: (year: number): Promise<number> =>
    ipcRenderer.invoke("db:createLedgerYear", year),

  deleteLedgerYear: (year: number, deleteTransactions: boolean = false): Promise<boolean> =>
    ipcRenderer.invoke("db:deleteLedgerYear", year, deleteTransactions),

  // ============================================
  // CATEGORIES
  // ============================================
  getCategories: (): Promise<Category[]> =>
    ipcRenderer.invoke("db:getCategories"),

  getCategoryById: (id: number): Promise<Category | undefined> =>
    ipcRenderer.invoke("db:getCategoryById", id),

  createCategory: (
    name: string,
    colorCode: string,
    icon: string,
    type: "income" | "expense" | "both"
  ): Promise<Category> =>
    ipcRenderer.invoke("db:createCategory", name, colorCode, icon, type),

  updateCategory: (
    id: number,
    name: string,
    colorCode: string,
    icon: string,
    type: "income" | "expense" | "both"
  ): Promise<Category | undefined> =>
    ipcRenderer.invoke("db:updateCategory", id, name, colorCode, icon, type),

  deleteCategory: (id: number): Promise<boolean> =>
    ipcRenderer.invoke("db:deleteCategory", id),

  // ============================================
  // ACCOUNTS
  // ============================================

  getAccounts: (): Promise<Account[]> => ipcRenderer.invoke("db:getAccounts"),
  getAccountTypes: (): Promise<AccountType[]> => ipcRenderer.invoke("db:getAccountTypes"),
  getAccountById: (id: number): Promise<Account | undefined> => ipcRenderer.invoke("db:getTransactions", id),
  getAccountTypeById: (id: number): Promise<AccountType | undefined> => ipcRenderer.invoke("db:getAccountTypeById", id),
  insertAccount: (account: Account): Promise<number | null> => ipcRenderer.invoke("db:insertAccount", account),
  insertAccountType: (accountType: AccountType): Promise<number | null> => ipcRenderer.invoke("db:insertAccountType", accountType),
  resetDefault: (): Promise<void> => ipcRenderer.invoke("db:resetDefault"),
  editAccount: (account: Account): Promise<Account | undefined> => ipcRenderer.invoke("db:editAccount", account),
  editAccountType: (accountType: AccountType): Promise<AccountType | undefined> => ipcRenderer.invoke("db:editAccountType", accountType),
  deleteAccountById: (id: number, strategy: 'transfer' | 'delete', transferToAccountId?: number): Promise<boolean> => ipcRenderer.invoke("db:deleteAccountById", id, strategy, transferToAccountId),
  deleteAccountTypeById: (id: number): Promise<boolean> => ipcRenderer.invoke("db:deleteAccountTypeById", id),

  // ============================================
  // TRANSACTIONS
  // ============================================
  getTransactions: (
    ledgerMonth?: LedgerMonth | null,
    limit?: number
  ): Promise<TransactionWithCategory[]> =>
    ipcRenderer.invoke("db:getTransactions", ledgerMonth, limit),

  getAllTransactions: (): Promise<TransactionWithCategory[]> =>
    ipcRenderer.invoke("db:getAllTransactions"),

  getTransactionById: (
    id: number
  ): Promise<TransactionWithCategory | undefined> =>
    ipcRenderer.invoke("db:getTransactionById", id),

  createTransaction: (
    input: CreateTransactionInput
  ): Promise<TransactionWithCategory> =>
    ipcRenderer.invoke("db:createTransaction", input),

  updateTransaction: (
    id: number,
    input: Partial<CreateTransactionInput>
  ): Promise<TransactionWithCategory | undefined> =>
    ipcRenderer.invoke("db:updateTransaction", id, input),

  deleteTransaction: (id: number): Promise<boolean> =>
    ipcRenderer.invoke("db:deleteTransaction", id),

  deleteTransactions: (ids: number[]): Promise<boolean> =>
    ipcRenderer.invoke("db:deleteTransactions", ids),

  updateTransactionsCategory: (ids: number[], categoryId: number | null): Promise<boolean> =>
    ipcRenderer.invoke("db:updateTransactionsCategory", ids, categoryId),

  updateTransactionsAccount: (ids: number[], accountId: number): Promise<boolean> =>
    ipcRenderer.invoke("db:updateTransactionsAccount", ids, accountId),

  searchTransactions: (
    options: SearchOptions,
    limit?: number
  ): Promise<TransactionWithCategory[]> =>
    ipcRenderer.invoke("db:searchTransactions", options, limit),

  getMonthlyTrends: (year: number): Promise<MonthlyTrend[]> =>
    ipcRenderer.invoke("db:getMonthlyTrends", year),

  getRollingMonthlyTrends: (): Promise<MonthlyTrend[]> =>
    ipcRenderer.invoke("db:getRollingMonthlyTrends"),

  getDailyTransactionSum: (year: number, month: number, type: 'income' | 'expense'): Promise<DailyTransactionSum[]> =>
    ipcRenderer.invoke("db:getDailyTransactionSum", year, month, type),

  getTotalMonthSpend: (year: number, month: number): Promise<number> =>
    ipcRenderer.invoke("db:getTotalMonthSpend", year, month),

  getNetWorthTrend: (): Promise<{ month: number, year: number, balance: number }[]> =>
    ipcRenderer.invoke("db:getNetWorthTrend"),

  getDatabaseVersion: (): Promise<number> =>
    ipcRenderer.invoke("db:getDatabaseVersion"),


  // ============================================
  // SYSTEM OPERATIONS
  // ============================================

  deleteAllDataFromTables: (): Promise<void> => ipcRenderer.invoke("db:deleteAllDataFromTables"),

  getPlatform: (): Promise<string> => ipcRenderer.invoke("system:getPlatform"),

  getDbPath: (): Promise<string> => ipcRenderer.invoke("system:getDbPath"),

  openDbLocation: (): Promise<void> =>
    ipcRenderer.invoke("system:openDbLocation"),

  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke("system:openExternal", url),

  deleteDatabase: (): Promise<boolean> =>
    ipcRenderer.invoke("system:deleteDatabase"),

  quitApp: (): Promise<void> =>
    ipcRenderer.invoke("app:quit"),

  exportDatabase: (payload : {data: string, defaultName?: string}): Promise<{success:boolean}> =>
    ipcRenderer.invoke("save-file", payload),

  importDatabase: () : Promise<{success: boolean, filepath? : string, data? : {
    databaseVersion?: number,
    accounts?: Account[],
    transactions?: TransactionWithCategory[],
    categories?: Category[],
    accountTypes?: AccountType[],
    ledgerYears?: number[],
    recurringTransactions?: RecurringTransaction[]
  }}> =>
    ipcRenderer.invoke("import-file"),

  // ============================================
  // AUTOMATED BACKUPS
  // ============================================

  getBackupSettings: (): Promise<BackupSettings> =>
    ipcRenderer.invoke('backup:getSettings'),

  saveBackupSettings: (partial: Partial<Pick<BackupSettings, 'enabled' | 'folder' | 'frequency' | 'hasSeenBackupPrompt'>>): Promise<BackupSettings> =>
    ipcRenderer.invoke('backup:saveSettings', partial),

  selectBackupFolder: (): Promise<{ canceled?: boolean; folder?: string }> =>
    ipcRenderer.invoke('backup:selectFolder'),

  runBackupNow: (type: 'auto' | 'manual', override: boolean): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('backup:runNow', type, override),

  getLatestManualBackup: (): Promise<{ exists: boolean; filename: string | null }> =>
    ipcRenderer.invoke('backup:getLatestManualBackup'),

  onSilentBackupComplete: (callback: () => void) => {
    ipcRenderer.on('silent-backup-complete', callback);
  },

  // ============================================
  // GENERIC IPC (for future use)
  // ============================================
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },
  off: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.off(channel, callback);
  },
};

// Expose the API to the renderer
contextBridge.exposeInMainWorld("electronAPI", electronAPI);

// Type declaration for the window object
export type ElectronAPI = typeof electronAPI;
