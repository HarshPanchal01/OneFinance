import { describe, it, expect } from 'vitest';
import { 
  formatCurrency, 
  toIsoDateString, 
  getMonthName, 
  isValidHexColor,
  calculateSavingsRate,
  calculateAvgDailySpend,
  calculateNetCashFlow,
  getDateRange,
  getMetricsForRange,
  getExpenseBreakdownForRange,
  verifyImportData
} from '@/utils';
import { Account, Category, AccountType, TransactionWithCategory } from '@/types';

describe('Utils', () => {
  describe('Formatting', () => {
    it('formatCurrency', () => {
      console.log('[Test: Utils] Testing formatCurrency');
      expect(formatCurrency(1000)).toBe('$1,000.00');
      expect(formatCurrency(12.34)).toBe('$12.34');
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('toIsoDateString', () => {
      console.log('[Test: Utils] Testing toIsoDateString');
      const date = new Date(2023, 0, 15); // Jan 15, 2023
      expect(toIsoDateString(date)).toBe('2023-01-15');
    });

    it('getMonthName', () => {
      expect(getMonthName(1)).toBe('January');
      expect(getMonthName(12)).toBe('December');
      expect(getMonthName(0)).toBe('');
    });

    it('isValidHexColor', () => {
      expect(isValidHexColor('#ffffff')).toBe(true);
      expect(isValidHexColor('#000')).toBe(true);
      expect(isValidHexColor('ffffff')).toBe(false);
    });
  });

  describe('Financial Calculations', () => {
    it('calculateSavingsRate', () => {
      console.log('[Test: Utils] Testing calculateSavingsRate');
      expect(calculateSavingsRate(100, 50)).toBe(50); // 50%
      expect(calculateSavingsRate(100, 0)).toBe(100); // 100%
      expect(calculateSavingsRate(100, 150)).toBe(-50); // -50%
      expect(calculateSavingsRate(0, 50)).toBe(0); // Avoid division by zero
    });

    it('calculateAvgDailySpend', () => {
      expect(calculateAvgDailySpend(300, 30)).toBe(10);
      expect(calculateAvgDailySpend(0, 30)).toBe(0);
      expect(calculateAvgDailySpend(300, 0)).toBe(0); // Avoid division by zero
    });

    it('calculateNetCashFlow', () => {
      expect(calculateNetCashFlow(1000, 800)).toBe(200);
      expect(calculateNetCashFlow(500, 600)).toBe(-100);
    });
  });

  describe('Date Ranges & Metrics', () => {
    // Mock Transactions
    const mockTransactions: TransactionWithCategory[] = [
      {
        id: 1, ledgerPeriodId: 1, title: 'Salary', amount: 5000, date: '2023-01-15', type: 'income',
        categoryId: 1, accountId: 1, categoryName: 'Salary', categoryColor: '#000', categoryIcon: 'pi-money', notes: ''
      },
      {
        id: 2, ledgerPeriodId: 1, title: 'Rent', amount: 1500, date: '2023-01-01', type: 'expense',
        categoryId: 2, accountId: 1, categoryName: 'Housing', categoryColor: '#000', categoryIcon: 'pi-home', notes: ''
      },
      {
        id: 3, ledgerPeriodId: 1, title: 'Groceries', amount: 200, date: '2023-01-10', type: 'expense',
        categoryId: 3, accountId: 1, categoryName: 'Food', categoryColor: '#000', categoryIcon: 'pi-cart', notes: ''
      },
      {
        id: 4, ledgerPeriodId: 1, title: 'Old Tx', amount: 100, date: '2022-12-31', type: 'expense',
        categoryId: 3, accountId: 1, categoryName: 'Food', categoryColor: '#000', categoryIcon: 'pi-cart', notes: ''
      }
    ];

    it('getDateRange returns correct dates for "thisMonth"', () => {
      const { startDate, endDate } = getDateRange('thisMonth');
      const now = new Date();
      expect(startDate.getDate()).toBe(1);
      expect(startDate.getMonth()).toBe(now.getMonth());
      expect(startDate.getFullYear()).toBe(now.getFullYear());
      expect(endDate.getDate()).toBe(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
    });

    it('getMetricsForRange correctly filters and sums transactions', () => {
      const customRange = {
        startDate: new Date('2023-01-01T00:00:00'),
        endDate: new Date('2023-01-31T23:59:59')
      };

      const metrics = getMetricsForRange('custom', mockTransactions, customRange);
      expect(metrics.income).toBe(5000);
      expect(metrics.expense).toBe(1700);
    });

    it('getExpenseBreakdownForRange groups by category', () => {
       const customRange = {
        startDate: new Date('2023-01-01T00:00:00'),
        endDate: new Date('2023-01-31T23:59:59')
      };

      const breakdown = getExpenseBreakdownForRange('custom', mockTransactions, customRange);
      expect(breakdown).toHaveLength(2);
      
      const housing = breakdown.find(b => b.categoryName === 'Housing');
      expect(housing).toBeDefined();
      expect(housing?.total).toBe(1500);

      const food = breakdown.find(b => b.categoryName === 'Food');
      expect(food).toBeDefined();
      expect(food?.total).toBe(200);
    });
  });

  describe('Import Verification', () => {
    const validData = {
      accounts: [{ id: 1, accountName: 'Test', startingBalance: 0, accountTypeId: 1, isDefault: true }] as Account[],
      transactions: [{ id: 1, title: 'Tx', amount: 10, date: '2023-01-01', type: 'expense', accountId: 1 }] as TransactionWithCategory[],
      categories: [{ id: 1, name: 'Cat', colorCode: '#ffffff', icon: 'pi-tag' }] as Category[],
      accountTypes: [{ id: 1, type: 'Cash' }] as AccountType[],
      ledgerYears: [2023]
    };

    it('validates correct data structure', () => {
      expect(verifyImportData(validData)).toBe(true);
    });

    it('rejects missing required fields', () => {
      const invalidData = { ...validData, accounts: undefined };
      expect(verifyImportData(invalidData)).toBe(false);
    });

    it('rejects invalid hex colors', () => {
      const invalidColorData = {
        ...validData,
        categories: [{ id: 1, name: 'Cat', colorCode: 'invalid', icon: 'pi-tag' }] as Category[]
      };
      expect(verifyImportData(invalidColorData)).toBe(false);
    });
  });
});
