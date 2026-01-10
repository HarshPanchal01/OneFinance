<script setup lang="ts">
import { computed } from "vue";
import { useFinanceStore } from "@/stores/finance";
import AppChart from "@/components/AppChart.vue";

const store = useFinanceStore();

const categoryData = computed(() => {
  // Top 5 categories + Others
  const all = [...store.expenseBreakdown];
  const top = all.slice(0, 5);
  const others = all.slice(5);
  
  const labels = top.map(c => c.categoryName);
  const data = top.map(c => c.total);
  const bgColors = top.map(c => c.categoryColor);

  if (others.length > 0) {
    labels.push("Others");
    data.push(others.reduce((sum, c) => sum + c.total, 0));
    bgColors.push("#9ca3af");
  }

  return {
    labels,
    datasets: [
      {
        data,
        backgroundColor: bgColors,
        borderWidth: 0
      }
    ]
  };
});

const categoryOptions = {
    plugins: {
        legend: { position: 'right' }
    }
};
</script>

<template>
  <AppChart 
    type="doughnut" 
    :data="categoryData" 
    :options="categoryOptions" 
    height="100%" 
  />
</template>
