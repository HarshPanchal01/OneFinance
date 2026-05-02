<script setup lang="ts">
import { computed, onMounted, ref, toRaw } from "vue";
import { useFinanceStore } from "@/stores/finance";
import { useSettingsStore } from "@/stores/settings";
import { useFormatter } from "@/composables/useFormatter";
import TransactionItem from "@/components/TransactionItem.vue";
import TransactionModal from "@/components/TransactionModal.vue";
import ConfirmationModal from "@/components/ConfirmationModal.vue";
import ErrorModal from "@/components/ErrorModal.vue";
import BulkActionModal from "@/components/BulkActionModal.vue";
import { useTransactionActions } from "@/composables/useTransactionActions";

const store = useFinanceStore();
const settingsStore = useSettingsStore();
const { formatCurrency } = useFormatter();

const emit = defineEmits<{
  (e: "request-edit-account", id: number): void;
}>();

const {
  showModal,
  editingTransaction,
  confirmModal,
  openCreateModal,
  openEditModal,
  deleteTransaction,
  closeModal
} = useTransactionActions();

// Silence unused variable warning for template ref
void confirmModal;

onMounted(() => {
  // If a period is already selected (from Sidebar), fetch for that period.
  // If not (Global Mode), fetch all.
  const ledgerMonth = toRaw(store.currentLedgerMonth) ?? undefined;
  
  if (ledgerMonth) {
    store.fetchTransactions(ledgerMonth);
  } else if (store.selectedYear) {
    store.fetchTransactions(null, store.selectedYear);
  } else {
    store.fetchTransactions();
  }
});

// Filtered transactions
const filteredTransactions = computed(() => {
  // If searching globally, use search results as base
  return store.isSearching ? store.searchResults : store.transactions;
});

// Summary for filtered transactions
const filteredSummary = computed(() => {
  const income = filteredTransactions.value
    .filter((t) => t.type === "income" || (t.type === "transfer" && Boolean(t.isIncomeTransfer)))
    .reduce((sum, t) => sum + t.amount, 0);

  const expenses = filteredTransactions.value
    .filter((t) => t.type === "expense" || (t.type === "transfer" && Boolean(t.isExpenseTransfer)))
    .reduce((sum, t) => sum + t.amount, 0);

  return { income, expenses, balance: income - expenses };
});

// Navigate to account edit
function goToAccount(accountId: number) {
  emit("request-edit-account", accountId);
}

// --- Multi-Select & Bulk Actions ---
const selectedTransactionIds = ref<number[]>([]);

const selectableTransactions = computed(() => {
  return filteredTransactions.value.filter(t => t.type !== 'transfer');
});

const allSelected = computed(() => {
  return selectableTransactions.value.length > 0 && selectedTransactionIds.value.length === selectableTransactions.value.length;
});

const someSelected = computed(() => {
  return selectedTransactionIds.value.length > 0 && selectedTransactionIds.value.length < selectableTransactions.value.length;
});

function toggleAll(event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  if (checked) {
    selectedTransactionIds.value = selectableTransactions.value.map(t => t.id);
  } else {
    selectedTransactionIds.value = [];
  }
}

function toggleSelection(id: number, selected: boolean) {
  if (selected) {
    if (!selectedTransactionIds.value.includes(id)) {
      selectedTransactionIds.value.push(id);
    }
  } else {
    selectedTransactionIds.value = selectedTransactionIds.value.filter(tId => tId !== id);
  }
}

// Bulk Modals
const showBulkCategoryModal = ref(false);
const showBulkAccountModal = ref(false);
const bulkActionConfirmModal = ref<InstanceType<typeof ConfirmationModal> | null>(null);

async function confirmBulkDelete() {
  if (selectedTransactionIds.value.length === 0) return;
  
  const confirmed = await bulkActionConfirmModal.value?.openConfirmation({
    title: "Delete Transactions",
    message: `Are you sure you want to delete ${selectedTransactionIds.value.length} selected transaction(s)? This action cannot be undone.`,
    confirmText: "Delete",
    cancelText: "Cancel",
  });

  if (confirmed) {
    const success = await store.removeTransactions(selectedTransactionIds.value);
    if (success) {
      selectedTransactionIds.value = [];
    }
  }
}

async function handleBulkCategory(categoryId: number | null) {
  const success = await store.bulkEditCategory(selectedTransactionIds.value, categoryId);
  if (success) {
    selectedTransactionIds.value = [];
    showBulkCategoryModal.value = false;
  }
}

async function handleBulkAccount(accountId: number | null) {
  if (accountId === null) return;
  const success = await store.bulkEditAccount(selectedTransactionIds.value, accountId);
  if (success) {
    selectedTransactionIds.value = [];
    showBulkAccountModal.value = false;
  }
}
</script>

<template>
  <div class="h-full flex flex-col gap-4">
    <!-- Header with actions -->
    <div
      class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
    >
      <div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">
          {{ store.isSearching ? 'Search Results' : 'Transactions' }}
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          <span v-if="store.isSearching">Global Search</span>
          <span v-else-if="store.currentLedgerMonth">
            {{ store.currentLedgerMonth?.month }}/{{ store.currentLedgerMonth?.year }}
          </span>
          <span v-else-if="store.selectedYear">
            {{ store.selectedYear }} (All Months)
          </span>
          <span v-else>All Transactions</span>
          ({{ filteredTransactions.length }})
        </p>
      </div>

      <button
        v-if="!store.isSearching"
        class="inline-flex items-center px-4 py-2 bg-primary-50 dark:bg-primary-900/10 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg font-medium transition-colors"
        @click="openCreateModal"
      >
        <i class="pi pi-plus mr-2" />
        Add Transaction
      </button>
    </div>

    <!-- Summary Bar -->
    <div class="grid grid-cols-3 gap-4">
      <!-- ... (keep summary cards) ... -->
      <div class="card p-4 text-center">
        <p
          class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider"
        >
          Income
        </p>
        <p
          class="text-lg font-bold text-income"
          :class="{ 'privacy-blur': settingsStore.privacyMode }"
        >
          {{ formatCurrency(filteredSummary.income) }}
        </p>
      </div>
      <div class="card p-4 text-center">
        <p
          class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider"
        >
          Expenses
        </p>
        <p
          class="text-lg font-bold text-expense"
          :class="{ 'privacy-blur': settingsStore.privacyMode }"
        >
          {{ formatCurrency(filteredSummary.expenses) }}
        </p>
      </div>
      <div class="card p-4 text-center md:col-span-2 lg:col-span-1">
        <p
          class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider"
        >
          Balance
        </p>
        <p
          class="text-lg font-bold"
          :class="[
            filteredSummary.balance >= 0 ? 'text-income' : 'text-expense',
            { 'privacy-blur': settingsStore.privacyMode }
          ]"
        >
          {{ formatCurrency(filteredSummary.balance) }}
        </p>
      </div>
    </div>

    <!-- Transaction List -->
    <div class="card p-4 flex flex-col flex-1 min-h-0">
      <div
        v-if="filteredTransactions.length === 0"
        class="text-center py-12 text-gray-500 dark:text-gray-400 shrink-0"
      >
        <i
          class="pi pi-inbox text-5xl text-gray-300 dark:text-gray-600 mb-4"
        />
        <p class="text-lg">
          No transactions found
        </p>
        <p class="text-sm mt-1">
          {{
            store.isSearching
              ? "Try adjusting your filters"
              : "Add your first transaction to get started!"
          }}
        </p>
      </div>

      <div
        v-else
        class="space-y-2 flex-1 min-h-0 flex flex-col pr-2"
      >
        <!-- Select All Header -->
        <div class="flex items-center px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg shrink-0">
          <input
            type="checkbox"
            :checked="allSelected"
            :indeterminate="someSelected"
            class="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800"
            @change="toggleAll"
          />
          <span class="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
            Select All
          </span>
        </div>

        <div class="space-y-2 overflow-y-auto flex-1 min-h-0">
          <TransactionItem
            v-for="transaction in filteredTransactions"
            :key="transaction.id"
            :transaction="transaction"
            :selectable="transaction.type !== 'transfer'"
            :selected="selectedTransactionIds.includes(transaction.id)"
            @update:selected="toggleSelection(transaction.id, $event)"
            @edit="openEditModal"
            @delete="deleteTransaction"
            @edit-account="goToAccount"
          />
        </div>
      </div>
    </div>

    <!-- Transaction Modal -->
    <TransactionModal
      :visible="showModal"
      :transaction="editingTransaction"
      :default-year="store.currentLedgerMonth?.year"
      :default-month="store.currentLedgerMonth?.month"
      @close="closeModal"
      @saved="closeModal"
    />

    <ConfirmationModal ref="bulkActionConfirmModal" />
    <ErrorModal ref="errorModal" />

    <!-- Bulk Actions Toolbar -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="transform translate-y-full opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform translate-y-full opacity-0"
    >
      <div
        v-if="selectedTransactionIds.length > 0"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white dark:bg-gray-800 rounded-full shadow-2xl border border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center space-x-4"
      >
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ selectedTransactionIds.length }} selected
        </span>
        <div class="h-6 w-px bg-gray-200 dark:bg-gray-700" />
        <button
          class="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
          @click="showBulkCategoryModal = true"
        >
          <i class="pi pi-tag mr-1 text-xs" /> Category
        </button>
        <button
          class="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
          @click="showBulkAccountModal = true"
        >
          <i class="pi pi-wallet mr-1 text-xs" /> Account
        </button>
        <button
          class="text-sm font-medium text-expense hover:text-red-600 transition-colors"
          @click="confirmBulkDelete"
        >
          <i class="pi pi-trash mr-1 text-xs" /> Delete
        </button>
        <button
          class="ml-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          @click="selectedTransactionIds = []"
        >
          <i class="pi pi-times text-sm" />
        </button>
      </div>
    </Transition>

    <!-- Bulk Modals -->
    <BulkActionModal
      :visible="showBulkCategoryModal"
      mode="category"
      title="Change Category"
      @close="showBulkCategoryModal = false"
      @confirm="handleBulkCategory"
    />
    <BulkActionModal
      :visible="showBulkAccountModal"
      mode="account"
      title="Change Account"
      @close="showBulkAccountModal = false"
      @confirm="handleBulkAccount"
    />
  </div>
</template>
