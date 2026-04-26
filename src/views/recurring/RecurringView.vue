<script setup lang="ts">
import { ref, computed } from "vue";
import { useFinanceStore } from "@/stores/finance";
import { useSettingsStore } from "@/stores/settings";
import { useFormatter } from "@/composables/useFormatter";
import RecurringModal from "./components/RecurringModal.vue";
import ConfirmationModal from "@/components/ConfirmationModal.vue";
import { RecurringTransaction } from "@/types";

const emit = defineEmits<{
  (e: "request-view-transactions", id: number, type: 'account' | 'recurring'): void;
  (e: "request-edit-account", id: number): void;
}>();

const store = useFinanceStore();
const settingsStore = useSettingsStore();
const { formatCurrency, formatDate } = useFormatter();

const showModal = ref(false);
const editingItem = ref<RecurringTransaction | null>(null);
const confirmModalRef = ref<InstanceType<typeof ConfirmationModal> | null>(null);

const activeItems = computed(() => store.recurringTransactions.filter(r => r.isActive));
const inactiveItems = computed(() => store.recurringTransactions.filter(r => !r.isActive));

function handleNew() {
  editingItem.value = null;
  showModal.value = true;
}

function handleEdit(item: RecurringTransaction) {
  editingItem.value = item;
  showModal.value = true;
}

function handleViewTransactions(item: RecurringTransaction) {
  emit("request-view-transactions", item.id, 'recurring');
}

async function handleToggle(item: RecurringTransaction, isActive: boolean) {
  await store.toggleRecurringTransaction(item.id, isActive);
}

async function handleDelete(item: RecurringTransaction) {
  if (!confirmModalRef.value) return;
  const confirmed = await confirmModalRef.value.openConfirmation({
    title: "Delete Schedule",
    message: `Are you sure you want to delete "${item.title}"? This action cannot be undone, but past transactions will remain in your ledger.`,
    confirmText: "Delete",
    cancelText: "Cancel",
  });

  if (confirmed) {
    await store.removeRecurringTransaction(item.id);
  }
}

function getCategoryName(id: number | null) {
  if (!id) return 'No category';
  return store.categories.find(c => c.id === id)?.name ?? 'Unknown category';
}

function getAccountName(id: number) {
  return store.accounts.find(a => a.id === id)?.accountName ?? 'Unknown account';
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <header class="flex items-center justify-between px-4 h-14 bg-gray-100 dark:bg-gray-900 border-b border-transparent dark:border-gray-800 shrink-0">
      <div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">
          Schedules
        </h2>
      </div>
      <button
        class="inline-flex items-center px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors shadow-sm"
        @click="handleNew"
      >
        <i class="pi pi-plus mr-2 text-sm" /> New Schedule
      </button>
    </header>

    <!-- Content -->
    <div class="mt-4 flex-1 min-h-0 overflow-y-auto pr-2 pb-4">
      <div
        v-if="store.recurringTransactions.length === 0"
        class="card p-12 text-center flex flex-col items-center justify-center h-full"
      >
        <div class="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <i class="pi pi-sync text-2xl text-gray-400" />
        </div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No Recurring Schedules
        </h3>
        <p class="text-gray-500 mb-6 max-w-md">
          Automate your fixed cash flow like subscriptions, rent, and paychecks. They will be generated automatically when due.
        </p>
        <button 
          class="inline-flex items-center px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors shadow-sm"
          @click="handleNew"
        >
          <i class="pi pi-plus mr-2 text-sm" /> Add Your First Schedule
        </button>
      </div>

      <div
        v-else
        class="space-y-6"
      >
        <!-- Active -->
        <div v-if="activeItems.length > 0">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-1">
            Active
          </h3>
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow divide-y divide-gray-200 dark:divide-gray-700 overflow-hidden">
            <div 
              v-for="item in activeItems" 
              :key="item.id" 
              class="group flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div class="flex items-center gap-4">
                <div 
                  class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  :class="item.type === 'income' ? 'bg-income/10 text-income' : item.type === 'transfer' ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-500' : 'bg-expense/10 text-expense'"
                >
                  <i
                    class="pi"
                    :class="item.type === 'income' ? 'pi-arrow-up' : item.type === 'transfer' ? 'pi-sync' : 'pi-arrow-down'"
                  />
                </div>
                <div class="flex flex-col">
                  <p class="font-medium text-gray-900 dark:text-white">
                    {{ item.title }}
                  </p>
                  <p class="text-sm text-gray-500 flex items-center gap-1">
                    <span class="capitalize">{{ item.frequency }}</span>
                    <span class="mx-0.5">•</span>
                    <button
                      class="hover:text-primary-500 hover:underline transition-colors cursor-pointer"
                      @click="emit('request-edit-account', item.accountId)"
                    >
                      {{ getAccountName(item.accountId) }}
                    </button>
                    <span class="mx-0.5">•</span>
                    {{ item.type === 'transfer' ? 'Transfer' : getCategoryName(item.categoryId) }}
                  </p>
                  <p class="text-xs text-gray-400 mt-0.5">
                    Next: {{ formatDate(item.nextRunDate) }}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-6">
                <div class="text-right">
                  <p 
                    class="font-bold text-lg" 
                    :class="[
                      item.type === 'income' ? 'text-income' : item.type === 'transfer' ? 'text-transfer' : 'text-expense',
                      { 'privacy-blur': settingsStore.privacyMode }
                    ]"
                  >
                    {{ formatCurrency(item.amount) }}
                  </p>
                </div>

                <div class="flex items-center gap-2">
                  <div class="hidden group-hover:flex items-center gap-1 mr-2">
                    <button
                      class="p-2 text-gray-400 hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="Edit"
                      @click="handleEdit(item)"
                    >
                      <i class="pi pi-pencil text-sm" />
                    </button>
                    <button
                      class="p-2 text-gray-400 hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="View Transactions"
                      @click="handleViewTransactions(item)"
                    >
                      <i class="pi pi-list text-sm" />
                    </button>
                    <button
                      class="p-2 text-gray-400 hover:text-expense hover:bg-expense/10 rounded-lg transition-colors"
                      title="Delete"
                      @click="handleDelete(item)"
                    >
                      <i class="pi pi-trash text-sm" />
                    </button>
                  </div>
                  
                  <button
                    type="button"
                    role="switch"
                    :aria-checked="item.isActive"
                    class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                    :class="item.isActive ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'"
                    @click="handleToggle(item, !item.isActive)"
                  >
                    <span
                      aria-hidden="true"
                      class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                      :class="item.isActive ? 'translate-x-5' : 'translate-x-0'"
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Inactive -->
        <div v-if="inactiveItems.length > 0">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-1">
            Inactive
          </h3>
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow divide-y divide-gray-200 dark:divide-gray-700 overflow-hidden opacity-60">
            <div 
              v-for="item in inactiveItems" 
              :key="item.id" 
              class="group flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div class="flex items-center gap-4">
                <div 
                  class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-200 dark:bg-gray-800 text-gray-500"
                >
                  <i
                    class="pi"
                    :class="item.type === 'income' ? 'pi-arrow-up' : item.type === 'transfer' ? 'pi-sync' : 'pi-arrow-down'"
                  />
                </div>
                <div class="flex flex-col">
                  <p class="font-medium text-gray-900 dark:text-white">
                    {{ item.title }}
                  </p>
                  <p class="text-sm text-gray-500 flex items-center gap-1">
                    <span class="capitalize">{{ item.frequency }}</span>
                    <span class="mx-0.5">•</span>
                    <button
                      class="hover:text-primary-500 hover:underline transition-colors cursor-pointer"
                      @click="emit('request-edit-account', item.accountId)"
                    >
                      {{ getAccountName(item.accountId) }}
                    </button>
                    <span class="mx-0.5">•</span>
                    {{ item.type === 'transfer' ? 'Transfer' : getCategoryName(item.categoryId) }}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-6">
                <div class="text-right">
                  <p 
                    class="font-bold text-lg text-gray-500"
                    :class="{ 'privacy-blur': settingsStore.privacyMode }"
                  >
                    {{ formatCurrency(item.amount) }}
                  </p>
                </div>

                <div class="flex items-center gap-2">
                  <div class="hidden group-hover:flex items-center gap-1 mr-2">
                    <button
                      class="p-2 text-gray-400 hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="Edit"
                      @click="handleEdit(item)"
                    >
                      <i class="pi pi-pencil text-sm" />
                    </button>
                    <button
                      class="p-2 text-gray-400 hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="View Transactions"
                      @click="handleViewTransactions(item)"
                    >
                      <i class="pi pi-list text-sm" />
                    </button>
                    <button
                      class="p-2 text-gray-400 hover:text-expense hover:bg-expense/10 rounded-lg transition-colors"
                      title="Delete"
                      @click="handleDelete(item)"
                    >
                      <i class="pi pi-trash text-sm" />
                    </button>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    :aria-checked="item.isActive"
                    class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                    :class="item.isActive ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'"
                    @click="handleToggle(item, !item.isActive)"
                  >
                    <span
                      aria-hidden="true"
                      class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                      :class="item.isActive ? 'translate-x-5' : 'translate-x-0'"
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <RecurringModal
      v-if="showModal"
      :visible="showModal"
      :recurring="editingItem"
      @close="showModal = false"
    />

    <ConfirmationModal ref="confirmModalRef" />
  </div>
</template>