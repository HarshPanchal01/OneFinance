<script setup lang="ts">
import { computed } from 'vue';
import { useFinanceStore } from '@/stores/finance';
import { useFormatter } from '@/composables/useFormatter';

const props = defineProps<{
  sectorName: string;
  accountId: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const store = useFinanceStore();
const { formatCurrency } = useFormatter();

const sectorHoldings = computed(() => {
  const holdings = store.investmentHoldings.filter(h => 
    props.accountId === 'all' || h.accountId === parseInt(props.accountId)
  );

  const sectorTotals = new Map<string, number>();

  holdings.forEach(h => {
    if (h.quantity <= 0) return;
    const marketValue = h.quantity * (h.lastPrice || 0);

    if (!h.sectorWeightings) {
      sectorTotals.set('cash_and_equivalents', (sectorTotals.get('cash_and_equivalents') || 0) + marketValue);
      return;
    }

    try {
      const data = JSON.parse(h.sectorWeightings);
      if (!data) {
        sectorTotals.set('cash_and_equivalents', (sectorTotals.get('cash_and_equivalents') || 0) + marketValue);
        return;
      }
      
      let totalWeight = 0;
      
      if (Array.isArray(data)) {
        data.forEach(item => {
          const sector = Object.keys(item)[0];
          const weight = item[sector];
          const sectorValue = marketValue * weight;
          totalWeight += weight;
          sectorTotals.set(sector, (sectorTotals.get(sector) || 0) + sectorValue);
        });
      } else {
        const sector = Object.keys(data)[0];
        const weight = data[sector];
        const sectorValue = marketValue * weight;
        totalWeight += weight;
        sectorTotals.set(sector, (sectorTotals.get(sector) || 0) + sectorValue);
      }

      if (totalWeight < 1) {
        const remainingWeight = 1 - totalWeight;
        if (remainingWeight > 0.000001) {
          const remainingValue = marketValue * remainingWeight;
          sectorTotals.set('cash_and_equivalents', (sectorTotals.get('cash_and_equivalents') || 0) + remainingValue);
        }
      }
    } catch {
      sectorTotals.set('cash_and_equivalents', (sectorTotals.get('cash_and_equivalents') || 0) + marketValue);
    }
  });

  const sortedSectors = Array.from(sectorTotals.entries())
    .sort((a, b) => b[1] - a[1]);

  const top10Sectors = new Set(sortedSectors.slice(0, 10).map(([s]) => s));

  const breakdown: { symbol: string, name: string, amount: number }[] = [];

  holdings.forEach(h => {
    if (h.quantity <= 0) return;
    const marketValue = h.quantity * (h.lastPrice || 0);
    
    let processed = false;

    const addIfMatch = (rawSector: string, value: number) => {
      let sectorStr = rawSector.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      if (rawSector === 'realestate') sectorStr = 'Real Estate';
      if (rawSector === 'cash_and_equivalents') sectorStr = 'Cash & Equivalents';

      let isMatch = false;
      if (props.sectorName === 'Others') {
        isMatch = !top10Sectors.has(rawSector);
      } else {
        isMatch = (sectorStr === props.sectorName);
      }

      if (isMatch && value > 0) {
        const existing = breakdown.find(b => b.symbol === h.symbol);
        if (existing) {
          existing.amount += value;
        } else {
          breakdown.push({
            symbol: h.symbol,
            name: h.name || h.symbol,
            amount: value
          });
        }
      }
    };

    if (!h.sectorWeightings) {
      addIfMatch('cash_and_equivalents', marketValue);
      processed = true;
    }

    if (!processed) {
      try {
        const data = JSON.parse(h.sectorWeightings!);
        if (!data) {
          addIfMatch('cash_and_equivalents', marketValue);
          processed = true;
        } else {
          let parsedWeights: { sector: string, weight: number }[] = [];
          if (Array.isArray(data)) {
            data.forEach(item => {
              const rawSector = Object.keys(item)[0];
              parsedWeights.push({ sector: rawSector, weight: item[rawSector] });
            });
          } else {
            const rawSector = Object.keys(data)[0];
            parsedWeights.push({ sector: rawSector, weight: data[rawSector] });
          }

          let totalWeight = parsedWeights.reduce((sum, item) => sum + item.weight, 0);

          if (totalWeight > 1) {
             parsedWeights = parsedWeights.map(item => ({ sector: item.sector, weight: item.weight / totalWeight }));
             totalWeight = 1;
          }

          parsedWeights.forEach(item => {
             addIfMatch(item.sector, marketValue * item.weight);
          });

          if (totalWeight < 1) {
            const remainingWeight = 1 - totalWeight;
            if (remainingWeight > 0.000001) {
              addIfMatch('cash_and_equivalents', marketValue * remainingWeight);
            }
          }
        }
      } catch {
        addIfMatch('cash_and_equivalents', marketValue);
      }
    }
  });

  return breakdown.sort((a, b) => b.amount - a.amount);
});

const totalAmount = computed(() => sectorHoldings.value.reduce((sum, h) => sum + h.amount, 0));
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        class="absolute inset-0 bg-black/50"
        @click="emit('close')"
      />
      <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div class="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <div>
            <h3 class="text-xl font-bold text-gray-900 dark:text-white">
              {{ sectorName }} Exposure
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Total value: <span class="font-bold text-gray-700 dark:text-gray-300">{{ formatCurrency(totalAmount) }}</span>
            </p>
          </div>
          <div class="flex items-center space-x-3">
            <button
              class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              @click="emit('close')"
            >
              <i class="pi pi-times" />
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-0 min-h-[300px]">
          <div
            v-if="sectorHoldings.length === 0"
            class="text-center py-8 text-gray-500 dark:text-gray-400"
          >
            No holdings found for this sector.
          </div>
          
          <table
            v-else
            class="w-full text-sm text-left"
          >
            <thead class="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-900 sticky top-0 z-10 shadow-sm">
              <tr>
                <th class="px-6 py-3 font-semibold">
                  Asset
                </th>
                <th class="px-6 py-3 font-semibold text-right">
                  Value
                </th>
                <th class="px-6 py-3 font-semibold text-right">
                  Sector Weight
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
              <tr
                v-for="holding in sectorHoldings"
                :key="holding.symbol"
                class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <td class="px-6 py-4">
                  <div class="flex flex-col min-w-0">
                    <span class="font-bold text-gray-900 dark:text-white">{{ holding.symbol }}</span>
                    <span class="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-[250px]">{{ holding.name }}</span>
                  </div>
                </td>
                <td class="px-6 py-4 text-right font-medium text-gray-900 dark:text-white">
                  {{ formatCurrency(holding.amount) }}
                </td>
                <td class="px-6 py-4 text-right">
                  <span class="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-sm font-bold bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400 border border-primary-100 dark:border-primary-500/20">
                    {{ ((holding.amount / totalAmount) * 100).toFixed(1) }}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </Teleport>
</template>