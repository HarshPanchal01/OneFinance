<script setup lang="ts">
import { computed } from "vue";
import { useFinanceStore } from "@/stores/finance";
import AppChart from "@/components/AppChart.vue";

const props = defineProps<{
  accountId: string;
}>();

const store = useFinanceStore();

const topAssets = computed(() => {
  const holdings = store.investmentHoldings.filter(h => 
    props.accountId === 'all' || h.accountId === parseInt(props.accountId)
  );

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
  <div class="flex flex-col xl:flex-row h-full w-full items-start xl:justify-between gap-6 pt-2">
    <!-- Left Column: Total Text + Chart -->
    <div class="flex flex-col items-center justify-start gap-4 shrink-0 w-full xl:w-auto mt-2">
      <!-- Chart -->
      <div class="w-44 h-44 xl:w-52 xl:h-52">
        <div
          v-if="chartData.labels.length === 0"
          class="h-full w-full flex flex-col items-center justify-center bg-gray-50/50 dark:bg-gray-900/50 rounded-full border border-dashed border-gray-200 dark:border-gray-700"
        >
          <i class="pi pi-chart-pie text-2xl text-gray-300 dark:text-gray-600 mb-1" />
        </div>
        <AppChart
          v-else
          type="doughnut"
          :data="chartData"
          :options="chartOptions"
          height="100%"
        />
      </div>
    </div>

    <!-- Custom Legend (Right Side - Hidden on small screens) -->
    <div class="hidden xl:grid grid-cols-2 gap-x-6 gap-y-3 overflow-y-auto h-full pr-2 pb-2 w-full content-start">
      <div
        v-for="(asset, index) in topAssets"
        :key="asset.label"
        class="flex items-center gap-2 bg-gray-50/30 dark:bg-gray-800/30 rounded-lg p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div
          class="w-3 h-3 rounded-full flex shrink-0 shadow-sm"
          :style="{ backgroundColor: chartData.datasets[0].backgroundColor[index] }"
        />
        <div class="flex flex-col min-w-0 flex-1">
          <div class="flex justify-between items-baseline gap-2">
            <span class="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate">
              {{ asset.label }}
            </span>
            <span class="text-[11px] text-gray-500 dark:text-gray-400 font-medium shrink-0">
              {{ asset.percentage.toFixed(1) }}%
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
