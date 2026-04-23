<script setup lang="ts">
import { computed } from "vue";
import type { TransactionWithCategory } from "@/types";
import { formatCurrency, formatDate } from "@/utils";
import { useFinanceStore } from "@/stores/finance";

const props = defineProps<{
  transaction: TransactionWithCategory;
}>();

const emit = defineEmits<{
  edit: [transaction: TransactionWithCategory];
  delete: [id: number];
  "edit-account": [id: number];
}>();

const store = useFinanceStore();
const isIncome = computed(() => props.transaction.type === "income");
const isExpense = computed(() => props.transaction.type === "expense");
const isTransfer = computed(() => props.transaction.type === "transfer");

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
    class="group flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
  >
    <div class="flex items-center space-x-3">
      <!-- Category Icon -->
      <div
        class="w-10 h-10 rounded-lg flex items-center justify-center"
        :class="[
          isIncome ? 'bg-income-light dark:bg-income/20' : '',
          isExpense ? 'bg-expense-light dark:bg-expense/20' : '',
          isTransfer ? 'bg-primary-100 dark:bg-primary-900/20' : ''
        ]"
      >
        <i
          :class="['pi', isTransfer ? 'pi-sync' : (transaction.categoryIcon || 'pi-tag')]"
          :style="{ color: isTransfer ? '#3b82f6' : (transaction.categoryColor || '#6b7280') }"
        />
      </div>

      <!-- Details -->
      <div>
        <p class="font-medium text-gray-900 dark:text-white">
          {{ transaction.title }}
        </p>
        <p class="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
          <template v-if="isTransfer">
            <span>Transfer</span>
            <span class="mx-0.5">•</span>
            <button
              class="hover:text-primary-500 hover:underline transition-colors cursor-pointer"
              @click.stop="emit('edit-account', transaction.accountId)"
            >
              {{ accountName }}
            </button>
            <i class="pi pi-arrow-right text-[10px] mx-1" />
            <button
              class="hover:text-primary-500 hover:underline transition-colors cursor-pointer"
              @click.stop="emit('edit-account', transaction.transferAccountId!)"
            >
              {{ transferToAccountName }}
            </button>
          </template>
          <template v-else>
            <span>{{ transaction.categoryName || "Uncategorized" }}</span>
            <span
              v-if="accountName"
              class="mx-0.5"
            >•</span>
            <button
              v-if="accountName"
              class="hover:text-primary-500 hover:underline transition-colors cursor-pointer"
              @click.stop="emit('edit-account', transaction.accountId)"
            >
              {{ accountName }}
            </button>
          </template>
          <span class="mx-0.5">•</span>
          <span>{{ formatDate(transaction.date) }}</span>
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
            isTransfer ? 'text-gray-600 dark:text-gray-300' : ''
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
          @click="emit('edit', transaction)"
        >
          <i class="pi pi-pencil text-sm" />
        </button>
        <button
          class="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 hover:text-expense transition-colors"
          title="Delete"
          @click="emit('delete', transaction.id)"
        >
          <i class="pi pi-trash text-sm" />
        </button>
      </div>
    </div>
  </div>
</template>
