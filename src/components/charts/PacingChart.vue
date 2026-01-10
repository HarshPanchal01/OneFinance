<script setup lang="ts">
import { computed } from "vue";
import { useFinanceStore } from "@/stores/finance";
import AppChart from "@/components/AppChart.vue";

const store = useFinanceStore();

const pacingData = computed(() => {
  const current = store.pacingTrends.currentMonth;
  const previous = store.pacingTrends.previousAverage;

  // X Axis labels 1-31
  const labels = Array.from({length: 31}, (_, i) => i + 1);
  
  // Map data to array indices (day-1)
  const currentData = new Array(31).fill(null);
  const prevData = new Array(31).fill(null);

  current.forEach(d => {
      if (d.day >= 1 && d.day <= 31) currentData[d.day - 1] = d.total;
  });

  previous.forEach(d => {
      if (d.day >= 1 && d.day <= 31) prevData[d.day - 1] = d.total;
  });

  return {
    labels,
    datasets: [
      {
        label: "This Month",
        data: currentData,
        borderColor: "#3b82f6", // Blue
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        fill: true,
        tension: 0.4
      },
      {
        label: "3-Month Avg",
        data: prevData,
        borderColor: "#9ca3af", // Gray
        borderDash: [5, 5],
        tension: 0.4,
        pointRadius: 0
      }
    ]
  };
});

const pacingOptions = {
    scales: {
        x: {
            title: { display: true, text: 'Day of Month' }
        }
    }
};
</script>

<template>
  <AppChart 
    type="line" 
    :data="pacingData" 
    :options="pacingOptions" 
    height="100%" 
  />
</template>
