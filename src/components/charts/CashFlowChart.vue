<script setup lang="ts">
import { computed } from "vue";
import { useFinanceStore } from "../../stores/finance";
import { getMonthName } from "../../types";
import AppChart from "../AppChart.vue";

const store = useFinanceStore();

const chartData = computed(() => {
  const trends = store.monthlyTrends;
  const labels = trends.map((t) => getMonthName(t.month).substring(0, 3));
  const incomeData = trends.map((t) => t.totalIncome);
  const expenseData = trends.map((t) => t.totalExpenses);

  return {
    labels,
    datasets: [
      {
        label: "Income",
        backgroundColor: "#22c55e", // Green
        data: incomeData,
        borderRadius: 4,
      },
      {
        label: "Expenses",
        backgroundColor: "#ef4444", // Red
        data: expenseData,
        borderRadius: 4,
      },
    ],
  };
});
</script>

<template>
  <AppChart
    type="bar"
    :data="chartData"
    height="100%"
  />
</template>
