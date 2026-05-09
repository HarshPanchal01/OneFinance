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

  const breakdown: { symbol: string, name: string, amount: number }[] = [];

  holdings.forEach(h => {
    if (!h.sectorWeightings || h.quantity <= 0) return;
    
    const marketValue = h.quantity * (h.lastPrice || 0);
    try {
      const data = JSON.parse(h.sectorWeightings);
      if (!data) return;
      
      if (Array.isArray(data)) {
        // ETF Format
        data.forEach(item => {
          const rawSector = Object.keys(item)[0];
          const sectorStr = rawSector === 'realestate' ? 'Real Estate' : rawSector.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          
          if (sectorStr === props.sectorName) {
            const weight = item[rawSector];
            breakdown.push({
              symbol: h.symbol,
              name: h.name || h.symbol,
              amount: marketValue * weight
            });
          }
        });
      } else {
        // Stock Format
        const rawSector = Object.keys(data)[0];
        const sectorStr = rawSector === 'realestate' ? 'Real Estate' : rawSector.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        
        if (sectorStr === props.sectorName) {
          const weight = data[rawSector];
          breakdown.push({
            symbol: h.symbol,
            name: h.name || h.symbol,
            amount: marketValue * weight
          });
        }
      }
    } catch (e) {
      console.error("Failed to parse sector weightings", e);
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