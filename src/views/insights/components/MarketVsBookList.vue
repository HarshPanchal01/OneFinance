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
const { formatCurrency, formatCurrencyIn, isForeignCurrency } = useFormatter();
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
      nativeBookValue: number;
      nativeOk: boolean;
      lastPrice: number;
      currency: string | null;
  }>();

  holdings.forEach(h => {
    if (h.quantity <= 0) return;

    // Market Value (converted to user currency)
    const marketValue = store.holdingMarketValue(h);

    // Calculate Book Value
    const hTxs = props.transactions
      .filter(t => t.holdingId === h.id)
      .sort((a, b) => a.date.localeCompare(b.date));

    let currentQty = 0;
    let currentBookValue = 0;
    // Book value is trade-date-FX converted (currency move counts toward gain/loss,
    // matching broker statements); the native walk feeds Average Cost, shown in the
    // holding's currency so it compares directly against the closing price. That
    // native sum is only meaningful when every trade is priced in the holding's
    // currency — legacy rows (null currency) are user-currency numbers, so a mixed
    // holding falls back to the converted average.
    let nativeBookValue = 0;
    let nativeOk = true;

    for (const tx of hTxs) {
      if ((tx.currency ?? null) !== (h.currency ?? null)) nativeOk = false;
      if (tx.type === 'buy') {
        const nativeCost = (tx.quantity * tx.price) + tx.fees;
        currentBookValue += nativeCost * (tx.fxRate ?? 1);
        nativeBookValue += nativeCost;
        currentQty += tx.quantity;
      } else if (tx.type === 'sell' && currentQty > 0) {
        const avgCost = currentBookValue / currentQty;
        const nativeAvgCost = nativeBookValue / currentQty;
        currentQty -= tx.quantity;
        currentBookValue -= (tx.quantity * avgCost);
        nativeBookValue -= (tx.quantity * nativeAvgCost);
      }
    }

    // Combine identical symbols across different accounts if "all" is selected
    const existing = assetData.get(h.symbol) || { name: h.name, quantity: 0, marketValue: 0, bookValue: 0, nativeBookValue: 0, nativeOk: true, lastPrice: h.lastPrice || 0, currency: h.currency ?? null };
    assetData.set(h.symbol, {
      name: existing.name || h.name,
      quantity: existing.quantity + h.quantity,
      marketValue: existing.marketValue + marketValue,
      bookValue: existing.bookValue + currentBookValue,
      nativeBookValue: existing.nativeBookValue + nativeBookValue,
      nativeOk: existing.nativeOk && nativeOk,
      lastPrice: h.lastPrice || 0, // Assuming the price is the same for the same symbol
      currency: h.currency ?? existing.currency
    });
  });

  const totalMarketValue = Array.from(assetData.values()).reduce((sum, a) => sum + a.marketValue, 0);

  return Array.from(assetData.entries())
    .map(([symbol, data]) => {
      const change = data.marketValue - data.bookValue;
      const percent = data.bookValue > 0 ? (change / data.bookValue) * 100 : 0;
      // Native so it compares directly against the closing price; a holding with
      // mixed-currency trades falls back to the converted (user-currency) average
      const avgCost = data.quantity > 0
        ? (data.nativeOk ? data.nativeBookValue : data.bookValue) / data.quantity
        : 0;
      const avgCostCurrency = data.nativeOk ? data.currency : null;
      const percentOfPortfolio = totalMarketValue > 0 ? (data.marketValue / totalMarketValue) * 100 : 0;
      
      return {
          symbol,
          ...data,
          change,
          percent,
          avgCost,
          avgCostCurrency,
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
              <!-- Average cost stays in the holding's native currency, like the quote price -->
              <span :class="{ 'privacy-blur': settingsStore.privacyMode }">
                {{ formatCurrencyIn(asset.avgCost, asset.avgCostCurrency) }}
                <span
                  v-if="isForeignCurrency(asset.avgCostCurrency)"
                  class="text-[10px] text-gray-400 dark:text-gray-500"
                >{{ asset.avgCostCurrency }}</span>
              </span>
            </td>
            <td class="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">
              <!-- Quote price stays in the holding's native currency -->
              <span :class="{ 'privacy-blur': settingsStore.privacyMode }">
                {{ formatCurrencyIn(asset.lastPrice, asset.currency) }}
                <span
                  v-if="isForeignCurrency(asset.currency)"
                  class="text-[10px] text-gray-400 dark:text-gray-500"
                >{{ asset.currency }}</span>
              </span>
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