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
  updateInvestmentTransactionFxRates,
  getInvestmentDividends,
  createInvestmentDividend,
  updateInvestmentDividend,
  deleteInvestmentDividend,
  updateInvestmentDividendFxRates,
  getHoldingActivity,
  getMeta,
  setMeta,
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
import { getQuote, getQuotes, getFxRates, searchSymbols, getAssetProfile, getHistoricalPrices, getHistoricalFxRate, getHistoricalFxRates, getDividendEvents } from "./finance";
import { Account, AccountType, CreateTransactionInput, LedgerMonth, SearchOptions, RecurringTransaction, InvestmentHolding, InvestmentTransaction, InvestmentDividend, SavingsGoal } from "@/types";
import { sharesHeldOn } from "@/utils";

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

  ipcMain.handle("db:getNetWorthTrend", async (_event, fxRates?: Record<string, number>) => {
    return getNetWorthTrend(fxRates);
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

  ipcMain.handle("db:getInvestmentDividends", async (_event, holdingId?: number) => {
    return getInvestmentDividends(holdingId);
  });

  ipcMain.handle("db:createInvestmentDividend", async (_event, data: Omit<InvestmentDividend, 'id'>) => {
    return createInvestmentDividend(data);
  });

  ipcMain.handle("db:updateInvestmentDividend", async (_event, id: number, data: Partial<Omit<InvestmentDividend, 'id'>>) => {
    return updateInvestmentDividend(id, data);
  });

  ipcMain.handle("db:deleteInvestmentDividend", async (_event, id: number) => {
    return deleteInvestmentDividend(id);
  });

  ipcMain.handle("db:getHoldingActivity", async (_event, holdingId: number) => {
    return getHoldingActivity(holdingId);
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

  ipcMain.handle("finance:getFxRates", async (_event, pairs: { from: string; to: string }[]) => {
    return getFxRates(pairs);
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

  ipcMain.handle("finance:getHistoricalFxRate", async (_event, from: string, to: string, date: string) => {
    return getHistoricalFxRate(from, to, date);
  });

  // Keep every trade's stored fxRate consistent with the user currency it
  // targets. `app_meta.tradeFxTarget` records which currency the rates were last
  // derived against; it only advances when every candidate row resolved, so a
  // failed/offline run self-heals on a later call (the 30-min refresh cycle)
  // instead of leaving stale-target rates forever. Modes:
  //   - target mismatch or `force` (import): re-derive ALL currency-carrying rows
  //   - otherwise: heal only rows whose fxRate is still null (offline creation)
  // One historical fetch per distinct trade currency (frugality rule); a healthy
  // steady-state call costs zero Yahoo requests. Legacy rows (null currency)
  // stay at rate 1 by design.
  ipcMain.handle("investments:recomputeTradeFx", async (_event, userCurrency: string, force = false) => {
    const fullRecompute = force || getMeta("tradeFxTarget") !== userCurrency;
    // Trades and dividends share the target marker and heal together — one
    // historical fetch per distinct currency covers both tables' dates.
    const rows = [
      ...getAllInvestmentTransactions()
        .filter(t => t.currency && (fullRecompute || t.fxRate == null))
        .map(t => ({ id: t.id, date: t.date, currency: t.currency!, kind: 'trade' as const })),
      ...getInvestmentDividends()
        .filter(d => d.currency && (fullRecompute || d.fxRate == null))
        .map(d => ({ id: d.id, date: d.date, currency: d.currency!, kind: 'dividend' as const })),
    ];

    const byCurrency = new Map<string, typeof rows>();
    for (const r of rows) {
      const list = byCurrency.get(r.currency) ?? [];
      list.push(r);
      byCurrency.set(r.currency, list);
    }

    const tradeUpdates: { id: number; fxRate: number | null }[] = [];
    const dividendUpdates: { id: number; fxRate: number | null }[] = [];
    let unresolved = 0;
    for (const [currency, group] of byCurrency) {
      const rates = await getHistoricalFxRates(currency, userCurrency, group.map(r => r.date));
      for (const r of group) {
        // No rate (fetch failed / gap) — leave the row untouched rather than
        // silently downgrading a good rate to 1; the un-advanced target marker
        // retries it next cycle
        const rate = rates.get(r.date);
        if (rate == null) { unresolved++; continue; }
        (r.kind === 'trade' ? tradeUpdates : dividendUpdates).push({ id: r.id, fxRate: rate });
      }
    }
    updateInvestmentTransactionFxRates(tradeUpdates);
    updateInvestmentDividendFxRates(dividendUpdates);
    if (unresolved === 0) setMeta("tradeFxTarget", userCurrency);
    return tradeUpdates.length + dividendUpdates.length;
  });

  // Auto-capture dividends from Yahoo chart() events. Rides the renderer's
  // 30-min refresh cycle but fetches at most once per symbol per day
  // (divSyncedThrough marker) — a same-day re-run costs zero Yahoo calls.
  // Markers only advance after a successful fetch, so an offline run retries
  // its whole window next cycle. Returns the earliest inserted date per
  // account so the caller can extend its history backfill past that date.
  ipcMain.handle("investments:syncDividends", async (_event, userCurrency: string) => {
    const today = new Date().toISOString().split('T')[0];
    const holdings = getInvestmentHoldings();
    const existingDividends = getInvestmentDividends();

    const tradesByHolding = new Map<number, InvestmentTransaction[]>();
    for (const t of getAllInvestmentTransactions()) {
      const list = tradesByHolding.get(t.holdingId) ?? [];
      list.push(t);
      tradesByHolding.set(t.holdingId, list);
    }
    const firstTradeDate = (hId: number) =>
      (tradesByHolding.get(hId) ?? []).reduce((min, t) => (!min || t.date < min) ? t.date : min, '');
    const lastTradeDate = (hId: number) =>
      (tradesByHolding.get(hId) ?? []).reduce((max, t) => t.date > max ? t.date : max, '');

    // A holding needs a sync when it hasn't synced today, has trade history to
    // size payouts against, and could still have held shares in the window —
    // sold-out holdings stop costing a daily fetch once the marker passes
    // their last trade.
    const needsSync = (h: InvestmentHolding) => {
      if (h.divSyncedThrough === today) return false;
      if (!firstTradeDate(h.id)) return false;
      if (h.quantity > 0) return true;
      return !h.divSyncedThrough || h.divSyncedThrough <= lastTradeDate(h.id);
    };

    const bySymbol = new Map<string, InvestmentHolding[]>();
    for (const h of holdings) {
      if (!needsSync(h)) continue;
      const list = bySymbol.get(h.symbol) ?? [];
      list.push(h);
      bySymbol.set(h.symbol, list);
    }

    let created = 0;
    const earliestByAccount: Record<number, string> = {};

    for (const [symbol, syncHoldings] of bySymbol) {
      // One fetch per symbol, from the oldest un-synced point across its holdings
      const since = syncHoldings
        .map(h => h.divSyncedThrough ?? firstTradeDate(h.id))
        .sort()[0];
      let events: { date: string; perShare: number }[];
      try {
        events = await getDividendEvents(symbol, since, today);
      } catch (e) {
        console.error(`[Dividends] Event fetch failed for ${symbol}:`, e);
        continue;
      }

      // Size each payout per holding, then resolve pay-date FX in one batch
      // per currency (holdings of one symbol share the quote currency)
      const pendingByHolding = new Map<number, { date: string; perShare: number; amount: number }[]>();
      const datesByCurrency = new Map<string, Set<string>>();
      for (const h of syncHoldings) {
        const trades = tradesByHolding.get(h.id) ?? [];
        const firstTrade = firstTradeDate(h.id);
        const pending: { date: string; perShare: number; amount: number }[] = [];
        for (const ev of events) {
          // Respect each holding's own window so a user-deleted auto row isn't
          // resurrected by a sibling holding's wider fetch span. divSyncedThrough
          // is INCLUSIVE (synced through & including it) — skip on-or-before it so
          // a deleted boundary-date row doesn't come back; the never-synced case
          // falls back to first ownership (skip strictly before the first trade).
          if (h.divSyncedThrough ? ev.date <= h.divSyncedThrough : ev.date < firstTrade) continue;
          const shares = sharesHeldOn(trades, ev.date);
          if (shares <= 0) continue;
          if (existingDividends.some(d => d.holdingId === h.id && d.date === ev.date)) continue;
          pending.push({ date: ev.date, perShare: ev.perShare, amount: ev.perShare * shares });
        }
        pendingByHolding.set(h.id, pending);
        if (h.currency && h.currency !== userCurrency && pending.length > 0) {
          const set = datesByCurrency.get(h.currency) ?? new Set<string>();
          pending.forEach(p => set.add(p.date));
          datesByCurrency.set(h.currency, set);
        }
      }

      const ratesByCurrency = new Map<string, Map<string, number | null>>();
      for (const [currency, dates] of datesByCurrency) {
        ratesByCurrency.set(currency, await getHistoricalFxRates(currency, userCurrency, [...dates]));
      }

      for (const h of syncHoldings) {
        for (const p of pendingByHolding.get(h.id) ?? []) {
          const currency = h.currency ?? null;
          // Unresolved rate stays null — the refresh-cycle recompute heals it
          const fxRate = !currency || currency === userCurrency
            ? 1
            : (ratesByCurrency.get(currency)?.get(p.date) ?? null);
          const row = createInvestmentDividend({
            holdingId: h.id, date: p.date, amount: p.amount, perShare: p.perShare,
            currency, fxRate, source: 'auto',
          });
          existingDividends.push(row);
          created++;
          if (!earliestByAccount[h.accountId] || p.date < earliestByAccount[h.accountId]) {
            earliestByAccount[h.accountId] = p.date;
          }
        }
        updateInvestmentHolding(h.id, { divSyncedThrough: today });
      }
    }

    return { created, earliestByAccount };
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
