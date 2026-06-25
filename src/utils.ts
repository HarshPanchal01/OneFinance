import { Account, AccountType, Category, TransactionWithCategory, CategoryBreakdown, RecurringTransaction } from "@/types";

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export function formatCurrency(amount: number, locale = 'en-US', currency = 'USD'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    currencyDisplay: 'narrowSymbol',
  }).format(amount);
}

export function toIsoDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDate(dateString: string, locale = 'en-US'): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(date);
}

export function getMonthName(month: number): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return months[month - 1] || "";
}

export function isValidHexColor(color: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color);
}

export function getStringColor(str: string, customColors?: string[]): string {
  // A palette specifically designed for high contrast and distinct adjacent colors
  const defaultColors = [
    '#3b82f6', // Blue
    '#ef4444', // Red
    '#10b981', // Green
    '#f59e0b', // Yellow/Orange
    '#8b5cf6', // Purple
    '#06b6d4', // Cyan
    '#ec4899', // Pink
    '#84cc16', // Lime
    '#f97316', // Orange
    '#6366f1', // Indigo
    '#14b8a6', // Teal
    '#eab308', // Yellow
    '#d946ef', // Fuchsia
    '#0ea5e9', // Light Blue
    '#22c55e', // Light Green
  ];

  const colors = customColors || defaultColors;

  // Better hashing to spread similar strings to different colors
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  hash = Math.abs(hash);
  
  // Use a prime multiplier to further scatter the index
  const index = (hash * 31) % colors.length;
  return colors[index];
}

export function getSectorColor(sectorName: string): string {
  const normalized = sectorName.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Semantic color mapping for known sectors
  switch (normalized) {
    case 'technology': return '#3b82f6'; // Blue
    case 'cashequivalents': return '#10b981'; // Green
    case 'financialservices': return '#14b8a6'; // Teal
    case 'healthcare': return '#ef4444'; // Red
    case 'energy': return '#f59e0b'; // Yellow/Orange
    case 'industrials': return '#6366f1'; // Indigo
    case 'consumercyclical': return '#ec4899'; // Pink
    case 'consumerdefensive': return '#8b5cf6'; // Purple
    case 'communicationservices': return '#0ea5e9'; // Light Blue
    case 'utilities': return '#f97316'; // Orange
    case 'basicmaterials': return '#84cc16'; // Lime
    case 'realestate': return '#a855f7'; // Lavender
    case 'others': return '#9ca3af'; // Gray
    default: return getStringColor(sectorName); // Fallback
  }
}

export interface ImportData {
  databaseVersion?: number;
  accounts?: Account[];
  transactions?: TransactionWithCategory[];
  categories?: Category[];
  accountTypes?: AccountType[];
  ledgerYears?: number[];
  recurringTransactions?: RecurringTransaction[];
  investmentHoldings?: any[];
  investmentTransactions?: any[];
  investmentHistory?: any[];
  investmentAdjustments?: any[];
}

export function verifyImportData(
  data: ImportData,
  currentDatabaseVersion: number
): { success: boolean; reason?: string } {
  try {
    const dbVersion = data.databaseVersion;
    const accounts = data.accounts;
    const transactions = data.transactions;
    const categories = data.categories;
    const accountTypes = data.accountTypes;
    const ledgerYears = data.ledgerYears;
    const recurringTransactions = data.recurringTransactions;
    const investmentHoldings = data.investmentHoldings;
    const investmentTransactions = data.investmentTransactions;
    const investmentHistory = data.investmentHistory;
    const investmentAdjustments = data.investmentAdjustments;

    if (dbVersion === undefined) {
      console.log("Import data is missing databaseVersion (v1.x export)");
      return { success: false, reason: "The backup file is from an older version of OneFinance (v1.x). Please update the older app to v2.0+ and re-export your data." };
    }

    if (dbVersion > currentDatabaseVersion) {
      console.log(`Import data database version ${dbVersion} is newer than current version ${currentDatabaseVersion}`);
      return { success: false, reason: `The backup file is from a newer version of OneFinance (v${dbVersion}). Please update your app to match before importing.` };
    }

    if (dbVersion < currentDatabaseVersion) {
      console.log(`Import data database version ${dbVersion} is older than current version ${currentDatabaseVersion}`);
      return { success: false, reason: `The backup file is from an older version of OneFinance (v${dbVersion}). Please update the older app and re-export your data.` };
    }

    if (accounts == undefined || transactions == undefined || categories == undefined || accountTypes == undefined || ledgerYears == undefined || recurringTransactions == undefined || investmentHoldings == undefined || investmentTransactions == undefined || investmentHistory == undefined || investmentAdjustments == undefined) {
      return { success: false, reason: "The selected file is not a valid OneFinance export file." };
    }

    let forEachResult = true;

    accounts.forEach((value) => {
      // Accounts essentials
      if (value.accountName == undefined || value.accountTypeId == undefined || value.id == undefined || value.startingBalance == undefined || value.isDefault == undefined) {
        forEachResult = false;
        return;
      }

      // Check if account type id is values
      if (accountTypes.find((accountTypeValue) => accountTypeValue.id === value.accountTypeId) == undefined) {
        forEachResult = false;
        return;
      }
    });

    transactions.forEach((value) => {
      // Check for transaction essentials
      if (
        value.id == undefined ||
        value.title == undefined ||
        value.amount == undefined ||
        value.date == undefined ||
        value.type == undefined ||
        value.accountId == undefined
      ) {
        forEachResult = false;
        return;
      }

      // Check if category provided in transaction is valid
      if (value.categoryId != undefined) {
        if (value.categoryName == undefined || value.categoryColor == undefined || value.categoryIcon == undefined) {
          forEachResult = false;
          return;
        }
        if (categories.find((categoryValue) => categoryValue.id === value.categoryId) == undefined) {
          forEachResult = false;
          return;
        }
        if (!isValidHexColor(value.categoryColor)) {
          forEachResult = false;
          return;
        }
      }

      // Check if account provided in transaction is valid
      if (accounts.find((accountValue) => accountValue.id === value.accountId) == undefined) {
        forEachResult = false;
        return;
      }

      // Check if transfer account provided in transaction is valid
      if (value.type === "transfer") {
        if (value.transferAccountId == undefined || accounts.find((accountValue) => accountValue.id === value.transferAccountId) == undefined) {
          forEachResult = false;
          return;
        }
      }
    });

    accountTypes.forEach((value) => {
      if (value.id == undefined || value.type == undefined) {
        forEachResult = false;
        return;
      }
      if (value.classification == undefined) {
        value.classification = "liquid";
      }
    });

    categories.forEach((value) => {
      if (value.id == undefined || value.name == undefined || value.colorCode == undefined || value.icon == undefined) {
        forEachResult = false;
        return;
      }
      if (!isValidHexColor(value.colorCode)) {
        forEachResult = false;
        return;
      }
    });

    ledgerYears.forEach((value) => {
      if (value == undefined) {
        forEachResult = false;
        return;
      }
    });

    return forEachResult ? { success: true } : { success: false, reason: "Invalid data format." };
  } catch (e) {
    console.log(`Error verifying import data ${e}`);
    return { success: false, reason: "Failed to parse import data." };
  }
}

export function getDateRange(range: string, transactions?: TransactionWithCategory[], customRange?: DateRange): DateRange {
  const now = new Date();
  let startDate = new Date();
  let endDate = new Date();
  
  // Default end date is end of today unless specified otherwise
  endDate.setHours(23, 59, 59, 999);

  if ((range === 'custom' || range === 'custom_edit') && customRange) {
    startDate = new Date(customRange.startDate);
    endDate = new Date(customRange.endDate);
    endDate.setHours(23, 59, 59, 999);
  } else if (range === 'thisMonth') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endDate.setHours(23, 59, 59, 999);
  } else if (range === 'last30Days') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  } else if (range === 'last3Months') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0);
    endDate.setHours(23, 59, 59, 999);
  } else if (range === 'last6Months') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0);
    endDate.setHours(23, 59, 59, 999);
  } else if (range === 'lastYear') {
    startDate = new Date(now.getFullYear() - 1, 0, 1);
    endDate = new Date(now.getFullYear() - 1, 11, 31);
    endDate.setHours(23, 59, 59, 999);
  } else if (range === 'thisYear') {
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = new Date(now.getFullYear(), 11, 31);
    endDate.setHours(23, 59, 59, 999);
  } else if (range === 'ytd') {
    startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  } else if (range === 'allTime') {
    startDate = new Date(0); 
    
    if (transactions && transactions.length > 0) {
      const newestTx = transactions[0];
      const oldestTx = transactions[transactions.length - 1];
      
      const [oy, om, od] = oldestTx.date.split('-').map(Number);
      startDate = new Date(oy, om - 1, od);

      const [ny, nm, nd] = newestTx.date.split('-').map(Number);
      const potentialEndDate = new Date(ny, nm - 1, nd);
      
      if (potentialEndDate > now) {
        endDate = potentialEndDate;
      }
      // Ensure endDate covers the full day of the last transaction
      endDate.setHours(23, 59, 59, 999);
    }
  }

  startDate.setHours(0, 0, 0, 0);
  
  return { startDate, endDate };
}

// The previous comparison window for a dashboard range, used for delta comparisons.
// To-date ranges (thisMonth, thisYear) compare against the prior period clamped to
// the same day, so a partial current period isn't compared against a full prior one.
// Returns null for ranges with no comparable prior period (e.g. allTime).
export function getPreviousDateRange(range: string, customRange?: DateRange): DateRange | null {
  const now = new Date();
  // A date clamped to the target month's last day (handles short months / leap years).
  const dayInMonth = (year: number, monthIndex: number, day: number) =>
    new Date(year, monthIndex, Math.min(day, new Date(year, monthIndex + 1, 0).getDate()));

  let startDate: Date;
  let endDate: Date;

  if (range === 'thisMonth') {
    // Current is month-to-date; compare against the prior month through the same day.
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = dayInMonth(now.getFullYear(), now.getMonth() - 1, now.getDate());
  } else if (range === 'last3Months') {
    // Current window is [m-3 .. end of m-1]; the prior equivalent is [m-6 .. end of m-4].
    startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    endDate = new Date(now.getFullYear(), now.getMonth() - 3, 0);
  } else if (range === 'last6Months') {
    // Current window is [m-6 .. end of m-1]; the prior equivalent is [m-12 .. end of m-7].
    startDate = new Date(now.getFullYear(), now.getMonth() - 12, 1);
    endDate = new Date(now.getFullYear(), now.getMonth() - 6, 0);
  } else if (range === 'thisYear') {
    // Current is year-to-date; compare against the prior year through the same month/day.
    startDate = new Date(now.getFullYear() - 1, 0, 1);
    endDate = dayInMonth(now.getFullYear() - 1, now.getMonth(), now.getDate());
  } else if ((range === 'custom' || range === 'custom_edit') && customRange) {
    // The equally-long window immediately before the selected one.
    const cur = getDateRange(range, undefined, customRange);
    const span = cur.endDate.getTime() - cur.startDate.getTime();
    endDate = new Date(cur.startDate.getTime() - 1);
    startDate = new Date(endDate.getTime() - span);
  } else {
    return null;
  }

  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);
  return { startDate, endDate };
}

export function getMetricsForRange(range: string, transactions: TransactionWithCategory[], customRange?: DateRange) {
  const { startDate, endDate } = getDateRange(range, transactions, customRange);
  
  // Calculate total days in range for average calculation
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  let daysDivisor = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (daysDivisor === 0) daysDivisor = 1;

  const filtered = transactions.filter(t => {
    const [y, m, d] = t.date.split('-').map(Number);
    const tDate = new Date(y, m - 1, d);
    return tDate >= startDate && tDate <= endDate;
  });

  const income = filtered.filter(t => t.type === 'income' || (t.type === 'transfer' && Boolean(t.isIncomeTransfer))).reduce((sum, t) => sum + t.amount, 0);
  const expense = filtered.filter(t => t.type === 'expense' || (t.type === 'transfer' && Boolean(t.isExpenseTransfer))).reduce((sum, t) => sum + t.amount, 0);

  return { income, expense, days: daysDivisor };
}

export function getExpenseBreakdownForRange(range: string, transactions: TransactionWithCategory[], customRange?: DateRange): CategoryBreakdown[] {
  const { startDate, endDate } = getDateRange(range, transactions, customRange);

  const filtered = transactions.filter(t => {
    if (t.type !== 'expense' && !(t.type === 'transfer' && Boolean(t.isExpenseTransfer))) return false;
    const [y, m, d] = t.date.split('-').map(Number);
    const tDate = new Date(y, m - 1, d);
    return tDate >= startDate && tDate <= endDate;
  });

  const breakdownMap = new Map<number, CategoryBreakdown>();

  for (const t of filtered) {
    const catId = t.categoryId || 0;
    const entry = breakdownMap.get(catId);
    if (entry) {
      entry.total += t.amount;
      entry.count += 1;
    } else {
      breakdownMap.set(catId, {
        categoryId: t.categoryId,
        categoryName: t.categoryName || 'Uncategorized',
        categoryColor: t.categoryColor || '#9ca3af',
        categoryIcon: t.categoryIcon || 'pi-tag',
        total: t.amount,
        count: 1
      });
    }
  }

  return Array.from(breakdownMap.values()).sort((a, b) => b.total - a.total);
}

export function getIncomeBreakdownForRange(range: string, transactions: TransactionWithCategory[], customRange?: DateRange): CategoryBreakdown[] {
  const { startDate, endDate } = getDateRange(range, transactions, customRange);

  const filtered = transactions.filter(t => {
    if (t.type !== 'income' && !(t.type === 'transfer' && Boolean(t.isIncomeTransfer))) return false;
    const [y, m, d] = t.date.split('-').map(Number);
    const tDate = new Date(y, m - 1, d);
    return tDate >= startDate && tDate <= endDate;
  });

  const breakdownMap = new Map<number, CategoryBreakdown>();

  for (const t of filtered) {
    const catId = t.categoryId || 0;
    const entry = breakdownMap.get(catId);
    if (entry) {
      entry.total += t.amount;
      entry.count += 1;
    } else {
      breakdownMap.set(catId, {
        categoryId: t.categoryId,
        categoryName: t.categoryName || 'Uncategorized',
        categoryColor: t.categoryColor || '#22c55e',
        categoryIcon: t.categoryIcon || 'pi-tag',
        total: t.amount,
        count: 1
      });
    }
  }

  return Array.from(breakdownMap.values()).sort((a, b) => b.total - a.total);
}

function formatCustomDate(date: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const y = date.getFullYear();
  const m = months[date.getMonth()];
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}-${d}-${y}`;
}

export function getTimeRangeLabel(range: string, customRange?: DateRange): string {
  switch (range) {
    case 'thisMonth': return 'this month';
    case 'last3Months': return 'last 3 months';
    case 'last6Months': return 'last 6 months';
    case 'lastYear': return 'last year';
    case 'thisYear': return 'this year (projected)';
    case 'ytd': return 'last 12 months (YTD)';
    case 'allTime': return 'all time history';
    case 'custom':
    case 'custom_edit': 
      if (customRange) {
        return `custom range (${formatCustomDate(customRange.startDate)} to ${formatCustomDate(customRange.endDate)})`;
      }
      return 'custom range';
    default: return '';
  }
}

 
export function getCustomRangeObj(dateRange: any): DateRange | undefined {
  if (Array.isArray(dateRange) && dateRange[0] && dateRange[1]) {
    return { startDate: dateRange[0], endDate: dateRange[1] };
  }
  return undefined;
}

export function calculateSavingsRate(income: number, expense: number): number {
  if (income === 0) return 0;
  return ((income - expense) / income) * 100;
}

export function calculateAvgDailySpend(expense: number, days: number): number {
  if (days === 0) return 0;
  return expense / days;
}

export function calculateNetCashFlow(income: number, expense: number): number {
  return income - expense;
}

 
export function getPacingLabel(date: any, defaultLabel: string): string {
  if (!date) return defaultLabel;
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
}

export function getMonthStr(date: Date): string {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    return `${y}-${String(m).padStart(2, '0')}`;
}