<script setup lang="ts">
import { computed } from "vue";
import { useFinanceStore } from "@/stores/finance";
import AppChart from "@/components/AppChart.vue";

const store = useFinanceStore();

const chartData = computed(() => {
  const history = store.investmentHistory;
  
  return {
    labels: history.map(h => h.date),
    datasets: [
      {
        label: 'Portfolio Value',
        data: history.map(h => h.totalValue),
        borderColor: '#6366f1',
        backgroundColor: '#6366f120',
        fill: true,
        tension: 0.4,
      },
    ],
  };
});

const chartOptions = {
  plugins: {
    legend: { display: false }
  },
  scales: {
    x: {
      display: true,
      grid: { display: false }
    },
    y: {
      display: true,
    }
  }
};
</script>

<template>
  <div class="h-full relative min-h-0">
    <div
      v-if="store.investmentHistory.length < 2"
      class="h-full flex flex-col items-center justify-center bg-gray-50/50 dark:bg-gray-900/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 absolute inset-0"
    >
      <i class="pi pi-chart-line text-3xl text-gray-300 dark:text-gray-600 mb-2" />
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Not enough history data yet.
      </p>
      <p class="text-[10px] text-gray-400 dark:text-gray-500">
        History is tracked when prices are refreshed.
      </p>
    </div>
    <div
      v-else
      class="absolute inset-0"
    >
      <AppChart
        type="line"
        :data="chartData"
        :options="chartOptions"
        height="100%"
      />
    </div>
  </div>
</template>
