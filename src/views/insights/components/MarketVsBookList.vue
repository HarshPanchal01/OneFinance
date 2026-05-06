<script setup lang="ts">
import { computed, ref, watch, nextTick } from "vue";
import { useFinanceStore } from "@/stores/finance";
import { useFormatter } from "@/composables/useFormatter";
import { useSettingsStore } from "@/stores/settings";
import type { InvestmentTransaction } from "@/types";

const props = defineProps<{
  accountId: string;
  transactions: InvestmentTransaction[];
  highlightedSymbol?: string | null;
}>();

const emit = defineEmits<{
  (e: 'open-history', symbol: string, accountId: string): void;
}>();

const store = useFinanceStore();
const { formatCurrency } = useFormatter();
const settingsStore = useSettingsStore();

const rowRefs = ref<Record<string, HTMLElement>>({});

const sortedHoldings = computed(() => {
  const holdings = store.investmentHoldings.filter(h => 
    props.accountId === 'all' || h.accountId === parseInt(props.accountId)
  );

  const assetData = new Map<string, { 
      name: string | null;
      quantity: number; 
      marketValue: number; 
      bookValue: number; 
      lastPrice: number;
  }>();

  holdings.forEach(h => {
    if (h.quantity <= 0) return;

    // Market Value
    const marketValue = h.quantity * (h.lastPrice || 0);

    // Calculate Book Value
    const hTxs = props.transactions
      .filter(t => t.holdingId === h.id)
      .sort((a, b) => a.date.localeCompare(b.date));

    let currentQty = 0;
    let currentBookValue = 0;

    for (const tx of hTxs) {
      if (tx.type === 'buy') {
        const cost = (tx.quantity * tx.price) + tx.fees;
        currentBookValue += cost;
        currentQty += tx.quantity;
      } else if (tx.type === 'sell' && currentQty > 0) {
        const avgCost = currentBookValue / currentQty;
        currentQty -= tx.quantity;
        currentBookValue -= (tx.quantity * avgCost);
      }
    }

    // Combine identical symbols across different accounts if "all" is selected
    const existing = assetData.get(h.symbol) || { name: h.name, quantity: 0, marketValue: 0, bookValue: 0, lastPrice: h.lastPrice || 0 };
    assetData.set(h.symbol, {
      name: existing.name || h.name,
      quantity: existing.quantity + h.quantity,
      marketValue: existing.marketValue + marketValue,
      bookValue: existing.bookValue + currentBookValue,
      lastPrice: h.lastPrice || 0 // Assuming the price is the same for the same symbol
    });
  });

  const totalMarketValue = Array.from(assetData.values()).reduce((sum, a) => sum + a.marketValue, 0);

  return Array.from(assetData.entries())
    .map(([symbol, data]) => {
      const change = data.marketValue - data.bookValue;
      const percent = data.bookValue > 0 ? (change / data.bookValue) * 100 : 0;
      const avgCost = data.quantity > 0 ? data.bookValue / data.quantity : 0;
      const percentOfPortfolio = totalMarketValue > 0 ? (data.marketValue / totalMarketValue) * 100 : 0;
      
      return { 
          symbol, 
          ...data, 
          change, 
          percent, 
          avgCost, 
          percentOfPortfolio 
      };
    })
    .sort((a, b) => b.marketValue - a.marketValue);
});

watch(() => props.highlightedSymbol, async (newSymbol) => {
  if (newSymbol) {
    await nextTick();
    if (rowRefs.value[newSymbol]) {
      rowRefs.value[newSymbol].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
});

</script>

<template>
  <div class="h-full w-full flex flex-col min-h-0 relative">
    <div
      v-if="sortedHoldings.length === 0"
      class="h-full flex flex-col items-center justify-center bg-gray-50/50 dark:bg-gray-900/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 absolute inset-0"
    >
      <i class="pi pi-list text-3xl text-gray-300 dark:text-gray-600 mb-2" />
      <p class="text-sm text-gray-500 dark:text-gray-400">
        No active holdings.
      </p>
    </div>
    
    <div
      v-else
      class="flex-1 overflow-x-auto overflow-y-auto pr-2 pb-2"
    >
      <table class="w-full text-sm text-left table-auto min-w-[700px]">
        <thead class="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-100 dark:bg-gray-800 sticky top-0 z-10 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <tr>
            <th class="px-4 py-3 font-semibold">
              Asset
            </th>
            <th class="px-4 py-3 font-semibold text-right">
              Quantity
            </th>
            <th class="px-4 py-3 font-semibold text-right">
              Average Cost
            </th>
            <th class="px-4 py-3 font-semibold text-right">
              Closing Price
            </th>
            <th class="px-4 py-3 font-semibold text-right">
              Closing Value
            </th>
            <th class="px-4 py-3 font-semibold text-right">
              Book Value
            </th>
            <th class="px-4 py-3 font-semibold text-right">
              Gain/Loss
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr
            v-for="asset in sortedHoldings"
            :key="asset.symbol"
            :ref="(el) => { if (el) rowRefs[asset.symbol] = el as HTMLElement }"
            class="group transition-colors"
            :class="{ 'bg-primary-50 dark:bg-primary-900/20 highlight-blink': asset.symbol === highlightedSymbol }"
          >
            <td class="px-4 py-3">
              <div class="flex flex-col">
                <span 
                  class="font-bold text-primary-500 dark:text-primary-400 leading-tight underline decoration-primary-300 dark:decoration-primary-600 underline-offset-2 w-max cursor-pointer hover:text-primary-600 dark:hover:text-primary-500 transition-colors"
                  @click="emit('open-history', asset.symbol, accountId)"
                >
                  {{ asset.symbol }}
                </span>
                <span
                  class="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[150px]"
                  :title="asset.name || asset.symbol"
                >{{ asset.name || asset.symbol }}</span>
              </div>
            </td>
            <td class="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">
              <span :class="{ 'privacy-blur': settingsStore.privacyMode }">{{ asset.quantity }}</span>
            </td>
            <td class="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">
              <span :class="{ 'privacy-blur': settingsStore.privacyMode }">{{ formatCurrency(asset.avgCost) }}</span>
            </td>
            <td class="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">
              <span :class="{ 'privacy-blur': settingsStore.privacyMode }">{{ formatCurrency(asset.lastPrice) }}</span>
            </td>
            <td class="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">
              <span :class="{ 'privacy-blur': settingsStore.privacyMode }">{{ formatCurrency(asset.marketValue) }}</span>
            </td>
            <td class="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">
              <span :class="{ 'privacy-blur': settingsStore.privacyMode }">{{ formatCurrency(asset.bookValue) }}</span>
            </td>
            <td class="px-4 py-3 text-right">
              <div class="flex flex-col items-end">
                <span 
                  class="font-semibold text-sm"
                  :class="[
                    asset.percent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
                    { 'privacy-blur': settingsStore.privacyMode }
                  ]"
                >
                  {{ asset.change >= 0 ? '+' : '' }}{{ formatCurrency(asset.change) }}
                </span>
                <span 
                  class="text-[10px] font-medium"
                  :class="[
                    asset.percent >= 0 ? 'text-green-600/80 dark:text-green-400/80' : 'text-red-600/80 dark:text-red-400/80',
                    { 'privacy-blur': settingsStore.privacyMode }
                  ]"
                >
                  {{ asset.percent >= 0 ? '+' : '' }}{{ asset.percent.toFixed(2) }}%
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
@keyframes highlight-fade {
  0%, 100% { background-color: transparent; }
  50% { background-color: rgba(79, 157, 221, 0.4); }
}

.highlight-blink {
  animation: highlight-fade 1s ease-in-out 3;
}
</style>