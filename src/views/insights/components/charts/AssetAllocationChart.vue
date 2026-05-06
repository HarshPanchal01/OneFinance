<script setup lang="ts">
import { computed } from "vue";
import { useFinanceStore } from "@/stores/finance";
import { useSettingsStore } from "@/stores/settings";
import AppChart from "@/components/AppChart.vue";
import { useFormatter } from "@/composables/useFormatter";

const props = defineProps<{
  accountId: string;
}>();

const emit = defineEmits<{
  (e: 'highlight-asset', symbol: string, accountId: string): void;
}>();

const store = useFinanceStore();
const settingsStore = useSettingsStore();
const { formatCurrency } = useFormatter();

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

const totalValue = computed(() => {
  return topAssets.value.reduce((sum, a) => sum + a.value, 0);
});

const chartData = computed(() => {
  const bgColors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6', '#f97316', '#3b82f6', '#9ca3af'];
  return {
    labels: topAssets.value.map(a => a.label),
    datasets: [
      {
        data: topAssets.value.map(a => a.value),
        backgroundColor: bgColors,
        hoverBackgroundColor: bgColors.map(c => c + '99'),
        borderColor: bgColors,
        hoverBorderColor: bgColors,
        borderWidth: 2,
        hoverOffset: 4,
      },
    ],
  };
});

const chartOptions = {
  layout: {
    padding: 8
  },
  plugins: {
    legend: { display: false },
  },
  cutout: '70%',
  onHover: (_event: any, chartElement: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (_event as any).native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
  },
  onClick: (_event: any, elements: any[]) => {
    if (elements && elements.length > 0) {
      const index = elements[0].index;
      const asset = topAssets.value[index];
      if (asset.label !== 'Others') {
        emit('highlight-asset', asset.label, props.accountId);
      }
    }
  }
};
</script>

<template>
  <div class="flex flex-col xl:flex-row h-full w-full items-center xl:justify-between gap-4">
    <!-- Left Column: Title + Chart -->
    <div class="flex flex-col items-center justify-start gap-0 shrink-0 w-full xl:w-auto mt-[-32px]">
      <h3 class="font-semibold text-gray-700 dark:text-gray-200 text-sm lg:text-base mb-2 lg:self-start xl:self-center whitespace-nowrap">
        <span class="lg:hidden xl:inline">Portfolio Allocation</span>
        <span class="hidden lg:inline xl:hidden">Allocation</span>
      </h3>

      <!-- Chart -->
      <div class="relative w-52 h-52 xl:w-60 xl:h-60">
        <!-- Total Text (Inside Donut) -->
        <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
          <span class="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase leading-tight mb-0.5">Total</span>
          <span
            class="text-base xl:text-xl font-bold text-gray-800 dark:text-white"
            :class="{ 'privacy-blur': settingsStore.privacyMode }"
          >{{ formatCurrency(totalValue) }}</span>
        </div>

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

    <!-- Custom Legend -->
    <div class="hidden xl:flex overflow-y-auto h-full pr-2 space-y-3 pt-14 pb-2 flex-col w-28 shrink-0">
      <div
        v-for="(asset, index) in topAssets"
        :key="asset.label"
        class="flex items-center gap-2"
        :class="{ 'cursor-pointer': asset.label !== 'Others', 'cursor-default': asset.label === 'Others' }"
        :title="asset.label"
        @click="asset.label !== 'Others' && emit('highlight-asset', asset.label, props.accountId)"
      >
        <div
          class="w-3 h-3 rounded-full flex shrink-0 shadow-sm"
          :style="{ backgroundColor: chartData.datasets[0].backgroundColor[index] }"
        />
        <div class="flex justify-between items-baseline gap-2 min-w-0 flex-1">
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
</template>
