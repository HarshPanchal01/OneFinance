<script setup lang="ts">
import { computed } from "vue";
import AppChart from "@/components/AppChart.vue";
import { toIsoDateString } from "@/utils";

const props = defineProps<{
  history: { date: string, totalValue: number }[];
  option: string;
}>();

const chartData = computed(() => {
  const now = new Date();
  let startDate = "";
  let endDate = "";

  if (props.option === "YTD") {
    startDate = toIsoDateString(new Date(now.getFullYear(), 0, 1));
    endDate = toIsoDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  } else {
    const year = parseInt(props.option);
    startDate = toIsoDateString(new Date(year, 0, 1));
    endDate = toIsoDateString(new Date(year, 11, 31));
  }

  const filteredHistory = props.history.filter(h => h.date >= startDate && h.date <= endDate);
  
  return {
    labels: filteredHistory.map(h => h.date),
    datasets: [
      {
        label: 'Portfolio Value',
        data: filteredHistory.map(h => h.totalValue),
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
      v-if="chartData.labels.length < 2"
      class="h-full flex flex-col items-center justify-center bg-gray-50/50 dark:bg-gray-900/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 absolute inset-0"
    >
      <i class="pi pi-chart-line text-3xl text-gray-300 dark:text-gray-600 mb-2" />
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Not enough history data for this period.
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
