<script setup lang="ts">
import { computed } from "vue";
import type { TransactionWithCategory } from "@/types";
import { useFinanceStore } from "@/stores/finance";
import { useSettingsStore } from "@/stores/settings";
import { useFormatter } from "@/composables/useFormatter";

const props = defineProps<{
  transaction: TransactionWithCategory;
  selectable?: boolean;
  selected?: boolean;
}>();

const emit = defineEmits<{
  edit: [transaction: TransactionWithCategory];
  delete: [id: number];
  "edit-account": [id: number];
  "update:selected": [selected: boolean];
}>();

const store = useFinanceStore();
const settingsStore = useSettingsStore();
const { formatCurrency, formatDate } = useFormatter();
const isIncome = computed(() => props.transaction.type === "income");
const isExpense = computed(() => props.transaction.type === "expense" || (props.transaction.type === "transfer" && props.transaction.isExpenseTransfer));
const isTransfer = computed(() => props.transaction.type === "transfer" && !props.transaction.isExpenseTransfer);

const accountName = computed(() => {
  if (!props.transaction.accountId) return null;
  const account = store.accounts.find((a) => a.id === props.transaction.accountId);
  return account ? account.accountName : null;
});

const transferToAccountName = computed(() => {
  if (!props.transaction.transferAccountId) return null;
  const account = store.accounts.find((a) => a.id === props.transaction.transferAccountId);
  return account ? account.accountName : null;
});
</script>

<template>
  <div
    class="group flex items-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
  >
    <!-- Checkbox for multi-select -->
    <div
      v-if="selectable"
      class="mr-3 flex items-center shrink-0"
    >
      <input
        type="checkbox"
        :checked="selected"
        class="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800"
        @change="emit('update:selected', ($event.target as HTMLInputElement).checked)"
        @click.stop
      />
    </div>

    <!-- Main content container -->
    <div class="flex-1 flex items-center justify-between min-w-0">
      <div class="flex items-center space-x-3 truncate pr-4">
        <!-- Category Icon -->
        <div
          class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          :class="[
            isIncome ? 'bg-income-light dark:bg-income/20' : '',
            isExpense ? 'bg-expense-light dark:bg-expense/20' : '',
            isTransfer ? 'bg-primary-100 dark:bg-primary-900/20' : ''
          ]"
        >
          <i
            :class="['pi', isTransfer ? 'pi-sync' : (transaction.categoryIcon || 'pi-tag')]"
            :style="{ color: isTransfer ? '#3b82f6' : (transaction.categoryColor || '#ef4444') }"
          />
        </div>

        <!-- Details -->
        <div class="truncate">
          <p class="font-medium text-gray-900 dark:text-white truncate">
            {{ transaction.title }}
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 truncate">
            <template v-if="transaction.type === 'transfer'">
              <span>Transfer</span>
              <span class="mx-0.5 shrink-0">•</span>
              <button
                class="hover:text-primary-500 hover:underline transition-colors cursor-pointer truncate"
                @click.stop="emit('edit-account', transaction.accountId)"
              >
                {{ accountName }}
              </button>
              <i class="pi pi-arrow-right text-[10px] mx-1 shrink-0" />
              <button
                class="hover:text-primary-500 hover:underline transition-colors cursor-pointer truncate"
                @click.stop="emit('edit-account', transaction.transferAccountId!)"
              >
                {{ transferToAccountName }}
              </button>
              <template v-if="transaction.isExpenseTransfer">
                <span class="mx-0.5 shrink-0">•</span>
                <span class="truncate">{{ transaction.categoryName || "Uncategorized" }}</span>
              </template>
            </template>
            <template v-else>
              <span class="truncate">{{ transaction.categoryName || "Uncategorized" }}</span>
              <span
                v-if="accountName"
                class="mx-0.5 shrink-0"
              >•</span>
              <button
                v-if="accountName"
                class="hover:text-primary-500 hover:underline transition-colors cursor-pointer truncate"
                @click.stop="emit('edit-account', transaction.accountId)"
              >
                {{ accountName }}
              </button>
            </template>
            <span class="mx-0.5 shrink-0">•</span>
            <span class="shrink-0">{{ formatDate(transaction.date) }}</span>
          </p>
        </div>
      </div>

      <div class="flex items-center space-x-3 shrink-0">
        <!-- Amount -->
        <div class="text-right">
          <p
            class="font-semibold"
            :class="[
              isIncome ? 'text-income' : '',
              isExpense ? 'text-expense' : '',
              isTransfer ? 'text-gray-600 dark:text-gray-300' : '',
              { 'privacy-blur': settingsStore.privacyMode }
            ]"
          >
            {{ isIncome ? "+" : (isExpense ? "-" : "") }}{{ formatCurrency(transaction.amount) }}
          </p>
        </div>

        <!-- Actions -->
        <div class="hidden group-hover:flex items-center space-x-1">
          <button
            class="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 hover:text-primary-500 transition-colors"
            title="Edit"
            @click.stop="emit('edit', transaction)"
          >
            <i class="pi pi-pencil text-sm" />
          </button>
          <button
            class="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 hover:text-expense transition-colors"
            title="Delete"
            @click.stop="emit('delete', transaction.id)"
          >
            <i class="pi pi-trash text-sm" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
