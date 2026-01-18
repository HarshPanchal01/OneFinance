import { setActivePinia, createPinia } from 'pinia';
import { useFinanceStore } from '@/stores/finance';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Account, AccountType, Category } from '@/types';

describe('Finance Store', () => {
  let store: ReturnType<typeof useFinanceStore>;

  const mockCategories: Category[] = [
    { id: 1, name: 'Food', colorCode: '#fff', icon: 'pi-food' }
  ];
  const mockAccounts: Account[] = [
    { id: 1, accountName: 'Bank', startingBalance: 1000, accountTypeId: 1, isDefault: true, balance: 1000 }
  ];
  const mockAccountTypes: AccountType[] = [{ id: 1, type: 'Checking' }];
  const mockYears = [2023];

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useFinanceStore();
    vi.clearAllMocks();

    // Default mock implementations
    (window.electronAPI.getCategories as any).mockResolvedValue([...mockCategories]);
    (window.electronAPI.getAccounts as any).mockResolvedValue([...mockAccounts]);
    (window.electronAPI.getAccountTypes as any).mockResolvedValue([...mockAccountTypes]);
    (window.electronAPI.getLedgerYears as any).mockResolvedValue([...mockYears]);
    (window.electronAPI.getTransactions as any).mockResolvedValue([]);
    (window.electronAPI.getMonthlyTrends as any).mockResolvedValue([]);
  });

  describe('Initialization', () => {
    it('fetches initial data', async () => {
      console.log('[Test: Store] Initializing store...');
      await store.initialize();
      expect(store.categories).toHaveLength(1);
      expect(store.accounts).toHaveLength(1);
      expect(store.ledgerYears).toHaveLength(1);
      expect(store.isLoading).toBe(false);
      console.log('[Test: Store] Initialization complete.');
    });
  });

  describe('Categories', () => {
    it('adds a category', async () => {
      console.log('[Test: Store] Adding category...');
      const newCat = { id: 2, name: 'Transport', colorCode: '#000', icon: 'pi-car' };
      (window.electronAPI.createCategory as any).mockResolvedValue(newCat);

      await store.addCategory('Transport', '#000', 'pi-car');
      
      expect(window.electronAPI.createCategory).toHaveBeenCalledWith('Transport', '#000', 'pi-car');
      expect(store.categories).toContainEqual(newCat);
      console.log('[Test: Store] Category added.');
    });

    it('edits a category', async () => {
      await store.initialize(); // Populate store.categories
      const updatedCat = { id: 1, name: 'Food & Dining', colorCode: '#fff', icon: 'pi-food' };
      (window.electronAPI.updateCategory as any).mockResolvedValue(updatedCat);

      await store.editCategory(1, 'Food & Dining', '#fff', 'pi-food');
      
      expect(store.categories[0].name).toBe('Food & Dining');
    });

    it('removes a category', async () => {
      await store.initialize();
      (window.electronAPI.deleteCategory as any).mockResolvedValue(true);

      await store.removeCategory(1);
      
      expect(store.categories).toHaveLength(0);
    });
  });

  describe('Accounts', () => {
    it('adds an account', async () => {
        console.log('[Test: Store] Adding account...');
        (window.electronAPI.insertAccount as any).mockResolvedValue(2);
        
        await store.addAccount({ id: 0, accountName: 'Savings', startingBalance: 0, accountTypeId: 1, isDefault: false });
        
        expect(window.electronAPI.insertAccount).toHaveBeenCalled();
        console.log('[Test: Store] Account added.');
    });

    it('removes an account', async () => {
        await store.removeAccount(1, 'delete');
        expect(window.electronAPI.deleteAccountById).toHaveBeenCalledWith(1, 'delete', undefined);
    });
  });

  describe('Transactions', () => {
    it('adds a transaction', async () => {
        console.log('[Test: Store] Adding transaction...');
        const input = {
            title: 'Test', amount: 100, date: '2023-01-01', type: 'expense' as const, accountId: 1
        };
        const created = { ...input, id: 10, categoryName: null, categoryColor: null, categoryIcon: null };
        (window.electronAPI.createTransaction as any).mockResolvedValue(created);

        await store.addTransaction(input);

        expect(store.transactions[0]).toEqual(created);
        console.log('[Test: Store] Transaction added.');
    });

    it('edits a transaction', async () => {
        // Setup initial state
        const initialTx = { id: 10, title: 'Old', amount: 100, date: '2023-01-01', type: 'expense' as const, accountId: 1 };
        store.transactions = [initialTx as any];
        
        const updatedTx = { ...initialTx, title: 'New' };
        (window.electronAPI.updateTransaction as any).mockResolvedValue(updatedTx);
        (window.electronAPI.getTransactionById as any).mockResolvedValue(updatedTx); // Mock for helper check

        await store.editTransaction(10, { title: 'New' });

        expect(store.transactions[0].title).toBe('New');
    });

    it('searches transactions', async () => {
        const searchResult = [{ id: 99, title: 'Found', amount: 50 }];
        (window.electronAPI.searchTransactions as any).mockResolvedValue(searchResult);

        await store.searchTransactions({ text: 'Found' });

        expect(store.isSearching).toBe(true);
        expect(store.searchResults).toEqual(searchResult);
    });
  });

  describe('Import', () => {
      it('imports data correctly', async () => {
          // Setup mocks for import flow
          (window.electronAPI.insertAccountType as any).mockResolvedValue(1);
          (window.electronAPI.insertAccount as any).mockResolvedValue(1);
          (window.electronAPI.createCategory as any).mockResolvedValue({ id: 1 });
          (window.electronAPI.createTransaction as any).mockResolvedValue({});
          
          const importData = {
              accounts: [{ id: 100, accountName: 'Imp Account', startingBalance: 0, accountTypeId: 100, isDefault: true }],
              accountTypes: [{ id: 100, type: 'Imp Type' }],
              categories: [{ id: 100, name: 'Imp Cat', colorCode: '#fff', icon: 'pi-tag' }],
              transactions: [{ id: 1000, title: 'Imp Tx', amount: 10, date: '2023-01-01', type: 'expense', accountId: 100, categoryId: 100 }],
              ledgerYears: [2023]
          };

          const success = await store.importDatabaseData(importData as any, false);

          expect(success).toBe(true);
          // Verify calls
          expect(window.electronAPI.insertAccountType).toHaveBeenCalled();
          expect(window.electronAPI.insertAccount).toHaveBeenCalled();
          expect(window.electronAPI.createCategory).toHaveBeenCalled();
          expect(window.electronAPI.createTransaction).toHaveBeenCalled();
      });
  });
});
