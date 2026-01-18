import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTransactionActions } from '@/composables/useTransactionActions';
import { createTestingPinia } from '@pinia/testing';
import { setActivePinia } from 'pinia';
import { useFinanceStore } from '@/stores/finance';

describe('useTransactionActions', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({
      createSpy: vi.fn,
      stubActions: false
    }));
  });

  it('manages modal state', () => {
    const { showModal, openCreateModal, closeModal } = useTransactionActions();

    expect(showModal.value).toBe(false);

    openCreateModal();
    expect(showModal.value).toBe(true);

    closeModal();
    expect(showModal.value).toBe(false);
  });

  it('sets editing transaction correctly', () => {
    const { editingTransaction, openEditModal } = useTransactionActions();
    const mockTx = { 
        id: 1, title: 'Test', amount: 10, date: '2023-01-01', type: 'expense' as const, 
        accountId: 1, ledgerPeriodId: 1, notes: null, categoryId: null,
        categoryName: null, categoryColor: null, categoryIcon: null
    };

    openEditModal(mockTx);
    expect(editingTransaction.value).toEqual(mockTx);
  });

  it('deletes transaction after confirmation', async () => {
    const { deleteTransaction, confirmModal } = useTransactionActions();
    const store = useFinanceStore();
    store.removeTransaction = vi.fn();

    // Mock the confirmation modal ref
    // The composable expects a ref to a component instance.
    // We can mock the openConfirmation method.
    confirmModal.value = {
        openConfirmation: vi.fn().mockResolvedValue(true) // User confirmed
    } as any;

    await deleteTransaction(123);

    expect(confirmModal.value!.openConfirmation).toHaveBeenCalled();
    expect(store.removeTransaction).toHaveBeenCalledWith(123);
  });

  it('does not delete if cancelled', async () => {
    const { deleteTransaction, confirmModal } = useTransactionActions();
    const store = useFinanceStore();
    store.removeTransaction = vi.fn();

    confirmModal.value = {
        openConfirmation: vi.fn().mockResolvedValue(false) // User cancelled
    } as any;

    await deleteTransaction(123);

    expect(store.removeTransaction).not.toHaveBeenCalled();
  });
});
