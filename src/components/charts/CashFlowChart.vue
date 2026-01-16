<script setup lang="ts">
import { computed } from "vue";
import { useFinanceStore } from "@/stores/finance";
import { getMonthName } from "@/utils";
import AppChart from "@/components/AppChart.vue";

const store = useFinanceStore();

const trends = computed(() => store.monthlyTrends);

const chartData = computed(() => {
  const currentTrends = trends.value;
  const labels = currentTrends.map((t) => getMonthName(t.month).substring(0, 3));
  const incomeData = currentTrends.map((t) => t.totalIncome);
  const expenseData = currentTrends.map((t) => t.totalExpenses);

  return {
    labels,
    datasets: [
      {
        label: "Income",
        backgroundColor: "#22c55e", // Green
        hoverBackgroundColor: "#22c55e99",
        borderColor: "#22c55e",
        hoverBorderColor: "#22c55e",
        borderWidth: 2,
        data: incomeData,
        borderRadius: 4,
      },
      {
        label: "Expenses",
        backgroundColor: "#ef4444", // Red
        hoverBackgroundColor: "#ef444499",
        borderColor: "#ef4444",
        hoverBorderColor: "#ef4444",
        borderWidth: 2,
        data: expenseData,
        borderRadius: 4,
      },
    ],
  };
});

const chartOptions = computed(() => ({
  animation: {
    duration: 1000,
    easing: "easeOutQuart" as const,
  },
  animations: {
    y: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      from: (ctx: any) => {
        if (ctx.chart.scales.y) {
          return ctx.chart.scales.y.getPixelForValue(0);
        }
        return 0;
      },
    },
  },
  plugins: {
    legend: {
      display: false, // Using custom legend in parent
    },
    tooltip: {
      callbacks: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        title: (context: any[]) => {
          const index = context[0].dataIndex;
          const t = trends.value[index];
          return t ? `${getMonthName(t.month)} ${t.year}` : '';
        }
      }
    }
  },
  scales: {
    x: {
      title: { display: true, text: 'Month(s)' }
    },
    y: {
      title: { display: true, text: 'Amount ($)' }
    }
  }
}));
</script>

<template>
  <div class="h-full w-full">
    <AppChart
      type="bar"
      :data="chartData"
      :options="chartOptions"
      height="100%"
    />
  </div>
</template>