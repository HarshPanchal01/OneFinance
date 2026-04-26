export interface LedgerMonth{
  month: number;
  year: number;
}

export interface LedgerYear{
  id: number;
  year: number;
}

export interface Category {
  id: number;
  name: string;
  colorCode: string;
  icon: string;
  type: "income" | "expense" | "both";
}

export interface AccountType{
  id: number
  type: string
}

export interface Account{
  id: number
  accountName: string
  institutionName?: string
  startingBalance: number
  balance?: number
  accountTypeId: number
  isDefault: boolean
}

export type RecurringFrequency = "weekly" | "bi-weekly" | "monthly" | "yearly";

export interface RecurringTransaction {
  id: number;
  title: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  categoryId: number | null;
  accountId: number;
  transferAccountId?: number | null;
  frequency: RecurringFrequency;
  startDate: string;
  nextRunDate: string;
  isActive: boolean;
}

export interface Transaction {
  id: number;
  ledgerPeriodId: number;
  title: string;
  amount: number;
  date: string;
  type: "income" | "expense" | "transfer";
  notes: string | null;
  categoryId: number | null;
  accountId: number;
  transferAccountId?: number | null;
  recurringId?: number | null;
}

export interface TransactionWithCategory extends Transaction {
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
}

export interface CreateTransactionInput {
  title: string;
  amount: number;
  date: string;
  type: "income" | "expense" | "transfer";
  notes?: string
  categoryId?: number
  accountId: number
  transferAccountId?: number
  recurringId?: number
}

export interface PeriodSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  transactionCount: number;
}

export interface CategoryBreakdown {
  categoryId: number | null;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  total: number;
  count: number;
}

export interface MonthlyTrend {
  month: number;
  year: number;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
}

export interface DailyTransactionSum {
  day: number;
  total: number;
}

export interface SearchOptions {
  text?: string;
  categoryIds?: number[];
  accountIds?: number[];
  recurringId?: number;
  fromDate?: string | null;
  toDate?: string | null;
  minAmount?: number | null;
  maxAmount?: number | null;
  type?: "income" | "expense" | "transfer" | null;
  sortOrder?: 'desc' | 'asc';
}
