<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { InvestmentHolding, InvestmentTransaction } from '@/types';
import { useFormatter } from '@/composables/useFormatter';

const props = defineProps<{
  holding: InvestmentHolding | null;
  accountId?: number | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const { formatDate, formatCurrency } = useFormatter();

const transactions = ref<(InvestmentTransaction & { holdingSymbol?: string })[]>([]);
const isLoading = ref(true);

onMounted(async () => {
  try {
    if (props.holding) {
      transactions.value = await window.electronAPI.getInvestmentTransactions(props.holding.id);
    } else if (props.accountId) {
      transactions.value = await window.electronAPI.getAccountInvestmentTransactions(props.accountId);
    }
  } catch (e) {
    console.error("Failed to fetch investment transactions", e);
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        class="absolute inset-0 bg-black/50"
        @click="emit('close')"
      />
      <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        <div class="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <div>
            <h3 class="text-xl font-bold text-gray-900 dark:text-white">
              Activity History
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ holding ? `Transaction ledger for ${holding.symbol}` : 'All trades for this account' }}
            </p>
          </div>
          <button
            class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            @click="emit('close')"
          >
            <i class="pi pi-times" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-0">
          <div
            v-if="isLoading"
            class="p-8 flex justify-center"
          >
            <i class="pi pi-spinner animate-spin text-2xl text-primary-500" />
          </div>
          <div
            v-else-if="transactions.length === 0"
            class="p-8 text-center text-gray-500"
          >
            No trades found.
          </div>
          <table
            v-else
            class="w-full text-sm text-left"
          >
            <thead class="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50/50 dark:bg-gray-800/50 sticky top-0 z-10">
              <tr>
                <th class="px-6 py-3 font-semibold">
                  Date
                </th>
                <th
                  v-if="!holding"
                  class="px-6 py-3 font-semibold"
                >
                  Asset
                </th>
                <th class="px-6 py-3 font-semibold">
                  Type
                </th>
                <th class="px-6 py-3 font-semibold text-right">
                  Quantity
                </th>
                <th class="px-6 py-3 font-semibold text-right">
                  Price
                </th>
                <th class="px-6 py-3 font-semibold text-right">
                  Fees
                </th>
                <th class="px-6 py-3 font-semibold text-right">
                  Total
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr
                v-for="tx in transactions"
                :key="tx.id"
                class="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                <td class="px-6 py-4 text-gray-900 dark:text-white whitespace-nowrap">
                  {{ formatDate(tx.date) }}
                </td>
                <td
                  v-if="!holding"
                  class="px-6 py-4 font-bold text-primary-600 dark:text-primary-400"
                >
                  {{ tx.holdingSymbol }}
                </td>
                <td class="px-6 py-4">
                  <span
                    :class="[
                      'px-2 py-1 text-[10px] font-bold uppercase rounded-full',
                      tx.type === 'buy' ? 'bg-expense-light text-expense dark:bg-expense/20' : 
                      (tx.type === 'sell' ? 'bg-income-light text-income dark:bg-income/20' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30')
                    ]"
                  >
                    {{ tx.type }}
                  </span>
                </td>
                <td class="px-6 py-4 text-right font-medium text-gray-900 dark:text-white">
                  {{ tx.quantity }}
                </td>
                <td class="px-6 py-4 text-right text-gray-600 dark:text-gray-300">
                  {{ formatCurrency(tx.price) }}
                </td>
                <td class="px-6 py-4 text-right text-gray-500 dark:text-gray-400">
                  {{ formatCurrency(tx.fees) }}
                </td>
                <td
                  class="px-6 py-4 text-right font-bold whitespace-nowrap"
                  :class="tx.type === 'buy' ? 'text-expense' : 'text-income'"
                >
                  <span v-if="tx.type === 'buy'">-</span><span v-else>+</span>
                  {{ formatCurrency((tx.quantity * tx.price) + (tx.type === 'buy' ? tx.fees : -tx.fees)) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </Teleport>
</template>