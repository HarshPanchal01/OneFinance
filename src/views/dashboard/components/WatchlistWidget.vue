<script setup lang="ts">
import { computed } from "vue";
import { useFinanceStore } from "@/stores/finance";
import { useFormatter } from "@/composables/useFormatter";

const emit = defineEmits<{
  (e: "view-investments", symbol?: string): void;
}>();

const store = useFinanceStore();
const { formatCurrency } = useFormatter();

// One row per symbol (holdings of the same symbol across accounts are merged).
// Day change comes from the previous close captured during the periodic quote
// fetch; rows are ranked by change, biggest gain first.
const watchlist = computed(() => {
  const bySymbol = new Map<string, { symbol: string; name: string | null; price: number | null }>();
  for (const h of store.investmentHoldings) {
    const entry = bySymbol.get(h.symbol) ?? { symbol: h.symbol, name: h.name, price: h.lastPrice };
    if (h.lastPrice != null) entry.price = h.lastPrice;
    if (h.name) entry.name = h.name;
    bySymbol.set(h.symbol, entry);
  }

  return [...bySymbol.values()]
    .map((e) => {
      const prevClose = store.quotePreviousCloses[e.symbol];
      const change =
        e.price != null && prevClose != null && prevClose !== 0
          ? ((e.price - prevClose) / prevClose) * 100
          : null;
      return { ...e, change };
    })
    .sort((a, b) => {
      // Biggest mover first (by magnitude); flat/unknown (0% or no data) sink to the bottom.
      const am = Math.abs(a.change ?? 0);
      const bm = Math.abs(b.change ?? 0);
      if (am === bm) return a.symbol.localeCompare(b.symbol);
      return bm - am;
    });
});

function changeClass(change: number | null): string {
  if (change == null || change === 0) return "text-gray-400 dark:text-gray-500";
  return change > 0 ? "text-income" : "text-expense";
}

function changeText(change: number | null): string {
  if (change == null) return "—";
  return `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
}
</script>

<template>
  <div class="card p-5 flex flex-col h-full">
    <div class="flex items-center justify-between mb-4 shrink-0">
      <h2 class="text-base font-semibold text-gray-900 dark:text-white">
        Watchlist
      </h2>
      <button
        class="btn-view-all"
        @click="emit('view-investments')"
      >
        View all
      </button>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto -mr-3 pr-3">
      <div
        v-if="watchlist.length === 0"
        class="h-full flex flex-col items-center justify-center py-6 text-gray-500 dark:text-gray-400"
      >
        <i class="pi pi-chart-line text-3xl text-gray-300 dark:text-gray-600 mb-2" />
        <p class="text-sm">
          No holdings yet
        </p>
      </div>

      <ul
        v-else
        class="space-y-2"
      >
        <li
          v-for="item in watchlist"
          :key="item.symbol"
          class="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          @click="emit('view-investments', item.symbol)"
        >
          <div class="min-w-0">
            <p class="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
              {{ item.symbol }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
              {{ item.name ?? item.symbol }}
            </p>
          </div>
          <div class="text-right shrink-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ item.price != null ? formatCurrency(item.price) : "—" }}
            </p>
            <p
              class="text-xs font-semibold"
              :class="changeClass(item.change)"
            >
              {{ changeText(item.change) }}
            </p>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
