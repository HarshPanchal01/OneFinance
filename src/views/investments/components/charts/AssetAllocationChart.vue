<script setup lang="ts">
import { computed } from "vue";
import { useFinanceStore } from "@/stores/finance";
import AppChart from "@/components/AppChart.vue";

const store = useFinanceStore();

const topAssets = computed(() => {
  const holdings = store.investmentHoldings;
  const allocationMap = new Map<string, number>();
  
  holdings.forEach(h => {
    const value = h.quantity * (h.lastPrice || 0);
    allocationMap.set(h.symbol, (allocationMap.get(h.symbol) || 0) + value);
  });
  
  const sorted = Array.from(allocationMap.entries())
    .map(([symbol, value]) => ({ symbol, value }))
    .sort((a, b) => b.value - a.value);
    
  const total = sorted.reduce((sum, s) => sum + s.value, 0);
  
  const top = sorted.slice(0, 10);
  const others = sorted.slice(10);
  
  const result = top.map(a => ({
    label: a.symbol,
    value: a.value,
    percentage: total > 0 ? (a.value / total) * 100 : 0
  }));
  
  if (others.length > 0) {
    const othersValue = others.reduce((sum, a) => sum + a.value, 0);
    result.push({
      label: 'Others',
      value: othersValue,
      percentage: total > 0 ? (othersValue / total) * 100 : 0
    });
  }
  
  return result;
});

const chartData = computed(() => ({
  labels: topAssets.value.map(a => a.label),
  datasets: [
    {
      data: topAssets.value.map(a => a.value),
      backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6', '#f97316', '#3b82f6', '#9ca3af'],
      hoverOffset: 4,
    },
  ],
}));

const chartOptions = {
  plugins: {
    legend: { display: false },
  }
};
</script>

<template>
  <div class="flex flex-col items-center h-full min-h-0">
    <div class="w-full flex-1 relative min-h-0">
      <AppChart
        type="doughnut"
        :data="chartData"
        :options="chartOptions"
        height="100%"
      />
    </div>
    
    <div class="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 w-full max-h-32 overflow-y-auto pr-2 shrink-0">
      <div
        v-for="(asset, index) in topAssets"
        :key="asset.label"
        class="flex items-center justify-between"
      >
        <div class="flex items-center min-w-0">
          <div 
            class="w-2 h-2 rounded-full mr-2 shrink-0" 
            :style="{ backgroundColor: chartData.datasets[0].backgroundColor[index] }" 
          />
          <span class="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{{ asset.label }}</span>
        </div>
        <span class="text-[10px] text-gray-500 shrink-0 ml-2">{{ asset.percentage.toFixed(1) }}%</span>
      </div>
    </div>
  </div>
</template>
