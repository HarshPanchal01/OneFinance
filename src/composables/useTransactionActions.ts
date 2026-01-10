import { ref } from 'vue';
import { useFinanceStore } from '@/stores/finance';
import type { Transaction, TransactionWithCategory } from '@/types';
import type ConfirmationModal from '@/components/ConfirmationModal.vue';

export function useTransactionActions() {
    const store = useFinanceStore();
    const showModal = ref(false);
    const editingTransaction = ref<Transaction | null>(null);
    const confirmModal = ref<InstanceType<typeof ConfirmationModal> | null>(null);

    function openCreateModal() {
        editingTransaction.value = null;
        showModal.value = true;
    }

    function openEditModal(transaction: TransactionWithCategory) {
        editingTransaction.value = transaction;
        showModal.value = true;
    }

    function closeModal() {
        showModal.value = false;
        editingTransaction.value = null;
    }

    async function deleteTransaction(id: number) {
        if (!confirmModal.value) return;
        
        const confirmed = await confirmModal.value.openConfirmation({
            title: "Delete Transaction",
            message: "Are you sure you want to delete this transaction?",
            cancelText: "Cancel",
            confirmText: "Delete",
        });

        if (confirmed) {
            await store.removeTransaction(id);
        }
    }

    return {
        showModal,
        editingTransaction,
        confirmModal,
        openCreateModal,
        openEditModal,
        closeModal,
        deleteTransaction
    };
}
