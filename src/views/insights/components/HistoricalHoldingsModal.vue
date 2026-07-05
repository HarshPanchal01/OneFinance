<script setup lang="ts">
import { ref, watch } from 'vue';
import { useFinanceStore } from '@/stores/finance';
import { useFormatter } from '@/composables/useFormatter';
import { formatDate, tradeCashImpact } from '@/utils';

const props = defineProps<{
  date: string;
  accountId: string;
  targetValue: number;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const store = useFinanceStore();
const { formatCurrency, formatCurrencyIn, isForeignCurrency } = useFormatter();

const isLoading = ref(true);
const holdingsData = ref<{symbol: string, name: string, quantity: number, price: number, total: number, currency: string | null}[]>([]);
const cashTotal = ref(0);

watch(() => props.date, async (newDate) => {
  if (!newDate) return;
  isLoading.value = true;
  
  // Reconstruct portfolio at `newDate`
  
  const allHoldings = store.investmentHoldings;
  const invTxnsRaw = await window.electronAPI.getAllInvestmentTransactions();
  const allTransactions = await window.electronAPI.getAllTransactions();
  const adjustmentsRaw = await window.electronAPI.getInvestmentAdjustments();
  
  let targetAccounts = store.accounts.filter(a => {
    const type = store.accountTypes.find(at => at.id === a.accountTypeId);
    return type?.classification === 'investment';
  });
  
  if (props.accountId !== 'all') {
    const aId = parseInt(props.accountId);
    targetAccounts = targetAccounts.filter(a => a.id === aId);
  }

  let computedCash = 0;
  
  const holdingMap = new Map<number, {symbol: string, name: string, quantity: number}>();
  
  for (const acc of targetAccounts) {
    if (!acc.id) continue;

    // 1. Calculate CURRENT cash for this account exactly as the dashboard does
    const accTxnsAll = allTransactions.filter(t => t.accountId === acc.id || t.transferAccountId === acc.id);
    const transactionSumAll = accTxnsAll.reduce((sum, t) => {
      if (t.accountId === acc.id && t.type === 'expense') return sum - t.amount;
      if (t.accountId === acc.id && t.type === 'income') return sum + t.amount;
      if (t.type === 'transfer') {
          if (t.accountId === acc.id) return sum - t.amount;
          if (t.transferAccountId === acc.id) return sum + t.amount;
      }
      return sum;
    }, 0);

    const adjTxnsAll = adjustmentsRaw.filter(a => a.accountId === acc.id);
    const adjustmentSumAll = adjTxnsAll.reduce((sum, a) => {
      if (a.type === 'income') return sum + a.amount;
      if (a.type === 'expense') return sum - a.amount;
      return sum;
    }, 0);

    const accHoldings = allHoldings.filter(h => h.accountId === acc.id);
    const hIds = accHoldings.map(h => h.id);
    const iTxnsAll = invTxnsRaw.filter(t => hIds.includes(t.holdingId));
    
    const investmentTradeSumAll = iTxnsAll.reduce((sum, it) => sum + tradeCashImpact(it), 0);

    let currentCash = acc.startingBalance + transactionSumAll + adjustmentSumAll + investmentTradeSumAll;

    // 2. Walk backwards: Undo any transactions that happened AFTER newDate
    const futureAccTxns = accTxnsAll.filter(t => t.date > newDate);
    futureAccTxns.forEach(t => {
      if (t.accountId === acc.id && t.type === 'expense') currentCash += t.amount;
      if (t.accountId === acc.id && t.type === 'income') currentCash -= t.amount;
      if (t.type === 'transfer') {
          if (t.accountId === acc.id) currentCash += t.amount;
          if (t.transferAccountId === acc.id) currentCash -= t.amount;
      }
    });

    const futureAdjTxns = adjTxnsAll.filter(a => a.date > newDate);
    futureAdjTxns.forEach(a => {
      if (a.type === 'income') currentCash -= a.amount;
      if (a.type === 'expense') currentCash += a.amount;
    });

    const futureITxns = iTxnsAll.filter(t => t.date > newDate);
    // Walking backwards: undo each future trade's cash impact
    futureITxns.forEach(it => { currentCash -= tradeCashImpact(it); });

    computedCash += currentCash;
    
    // 3. Reconstruct Holdings Quantity backwards
    for (const holding of accHoldings) {
      let currentQty = holding.quantity;
      const futureHoldingTxns = futureITxns.filter(t => t.holdingId === holding.id);
      
      futureHoldingTxns.forEach(t => {
          if (t.type === 'buy') currentQty -= t.quantity;
          if (t.type === 'sell') currentQty += t.quantity;
      });
      
      if (currentQty > 0) {
        if (!holdingMap.has(holding.id)) {
            holdingMap.set(holding.id, { symbol: holding.symbol, name: holding.name || holding.symbol, quantity: currentQty });
        } else {
             
            holdingMap.get(holding.id)!.quantity += currentQty;
        }
      }
    }
  }

  // Aggregate holdings across accounts
  const uniqueSymbols = new Map<string, {name: string, quantity: number}>();
  for (const h of holdingMap.values()) {
      if (uniqueSymbols.has(h.symbol)) {
           
          uniqueSymbols.get(h.symbol)!.quantity += h.quantity;
      } else {
          uniqueSymbols.set(h.symbol, { name: h.name, quantity: h.quantity });
      }
  }

  // Fetch prices for symbols at newDate
  const finalHoldings = [];
  const todayStr = new Date().toISOString().split('T')[0];
  
  for (const [symbol, data] of uniqueSymbols.entries()) {
      let price = 0;
      
      if (newDate === todayStr) {
          const matchingHolding = store.investmentHoldings.find(h => h.symbol === symbol);
          if (matchingHolding) {
              price = matchingHolding.lastPrice || 0;
          }
      }
      
      if (price === 0) {
          const history = await window.electronAPI.getHistoricalPrices(symbol, newDate, newDate);
          if (history && history.length > 0) {
              price = history[0].close;
          } else {
              // If the market was closed exactly on this day, we should fetch a 5 day window and get the closest.
              const datePast = new Date(newDate);
              datePast.setDate(datePast.getDate() - 5);
              const pastHistory = await window.electronAPI.getHistoricalPrices(symbol, datePast.toISOString().split('T')[0], newDate);
              if (pastHistory && pastHistory.length > 0) {
                  // Get the last one
                  pastHistory.sort((a,b) => a.date.localeCompare(b.date));
                  price = pastHistory[pastHistory.length - 1].close;
              }
          }
      }
      
      // Historical closes are native-currency; convert at the current cached rate
      // (matches how investment_history snapshots are valued)
      const currency = store.investmentHoldings.find(h => h.symbol === symbol)?.currency ?? null;
      const total = store.convertToUserCurrency(data.quantity * price, currency);
      finalHoldings.push({
          symbol,
          name: data.name,
          quantity: data.quantity,
          price,
          total,
          currency
      });
  }

  finalHoldings.sort((a, b) => b.total - a.total);
  
  // Notice that sometimes total computed here might slightly differ from targetValue if Yahoo data changed historically
  // but it will be very close. We'll show the exact calculated value of cash and holdings.
  holdingsData.value = finalHoldings;
  cashTotal.value = computedCash;
  isLoading.value = false;

}, { immediate: true });

</script>

<template>
  <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/50">
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0">
        <div>
          <h3 class="text-lg font-bold text-gray-900 dark:text-white">
            Portfolio Breakdown
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ formatDate(date) }} &bull; Total Value: {{ formatCurrency(targetValue) }}
          </p>
        </div>
        <button
          class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          @click="emit('close')"
        >
          <i class="pi pi-times" />
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6">
        <div
          v-if="isLoading"
          class="flex flex-col items-center justify-center h-48 space-y-4"
        >
          <i class="pi pi-spin pi-spinner text-3xl text-primary-500" />
          <p class="text-gray-500 dark:text-gray-400 text-sm">
            Reconstructing historical portfolio...
          </p>
        </div>
        <div
          v-else
          class="space-y-6"
        >
          <!-- Cash -->
          <div class="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                <i class="pi pi-money-bill" />
              </div>
              <div>
                <p class="font-semibold text-gray-900 dark:text-white">
                  Uninvested Cash
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  Across selected accounts
                </p>
              </div>
            </div>
            <p class="font-bold text-gray-900 dark:text-white">
              {{ formatCurrency(cashTotal) }}
            </p>
          </div>

          <!-- Holdings -->
          <div v-if="holdingsData.length > 0">
            <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
              Investments
            </h4>
            <div class="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <th class="px-4 py-3">
                      Asset
                    </th>
                    <th class="px-4 py-3 text-right">
                      Quantity
                    </th>
                    <th class="px-4 py-3 text-right">
                      Price
                    </th>
                    <th class="px-4 py-3 text-right">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                  <tr
                    v-for="h in holdingsData"
                    :key="h.symbol"
                    class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td class="px-4 py-3">
                      <p class="font-bold text-primary-600 dark:text-primary-400 text-sm">
                        {{ h.symbol }}
                      </p>
                      <p class="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                        {{ h.name }}
                      </p>
                    </td>
                    <td class="px-4 py-3 text-right font-medium text-gray-900 dark:text-white text-sm">
                      {{ h.quantity }}
                    </td>
                    <td class="px-4 py-3 text-right font-medium text-gray-900 dark:text-white text-sm">
                      <!-- Quote price stays in the holding's native currency -->
                      {{ formatCurrencyIn(h.price, h.currency) }}
                      <span
                        v-if="isForeignCurrency(h.currency)"
                        class="text-[10px] text-gray-400 dark:text-gray-500"
                      >{{ h.currency }}</span>
                    </td>
                    <td class="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                      {{ formatCurrency(h.total) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
