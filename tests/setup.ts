import { vi } from 'vitest';

if (typeof window !== 'undefined') {
  // Mock the electronAPI exposed via contextBridge
  window.electronAPI = {
    getLedgerYears: vi.fn().mockResolvedValue([]),
    createLedgerYear: vi.fn(),
    deleteLedgerYear: vi.fn(),
    getTransactions: vi.fn().mockResolvedValue([]),
    getTransactionById: vi.fn(),
    createTransaction: vi.fn(),
    updateTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
    getMonthlyTrends: vi.fn().mockResolvedValue([]),
    getRollingMonthlyTrends: vi.fn().mockResolvedValue([]),
    getNetWorthTrend: vi.fn().mockResolvedValue([]),
    getDailyTransactionSum: vi.fn().mockResolvedValue([]),
    getTotalMonthSpend: vi.fn().mockResolvedValue(0),
    getCategories: vi.fn().mockResolvedValue([]),
    getCategoryById: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    getAccounts: vi.fn().mockResolvedValue([]),
    getAccountTypes: vi.fn().mockResolvedValue([]),
    getAccountById: vi.fn(),
    getAccountTypeById: vi.fn(),
    insertAccount: vi.fn(),
    insertAccountType: vi.fn(),
    resetDefault: vi.fn(),
    editAccount: vi.fn(),
    editAccountType: vi.fn(),
    deleteAccountById: vi.fn(),
    deleteAccountTypeById: vi.fn(),
    deleteAllDataFromTables: vi.fn(),
    searchTransactions: vi.fn().mockResolvedValue([]),
    // System
    getDbPath: vi.fn(),
    openDbLocation: vi.fn(),
    deleteDatabase: vi.fn(),
    exportDatabase: vi.fn(),
    importDatabase: vi.fn(),
    // Generic
    on: vi.fn(),
    off: vi.fn(),
  };
}

// Mock window.matchMedia
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

if (typeof global !== 'undefined' && typeof window !== 'undefined') {
    // Mock global resize observer if needed (common in UI libs)
    global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    };
}
