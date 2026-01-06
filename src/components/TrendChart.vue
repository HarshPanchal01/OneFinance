<script setup lang="ts">
import { computed } from "vue";
import { useFinanceStore } from "../stores/finance";
import { getMonthName } from "../types";
import Chart from "primevue/chart";
import type { TooltipItem } from "chart.js";

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

const chartOptions = computed(() => {
  const textColor = "#4b5563"; // gray-600
  const textColorSecondary = "#9ca3af"; // gray-400
  const surfaceBorder = "#e5e7eb"; // gray-200

  return {
    maintainAspectRatio: false,
    aspectRatio: 0.8,
    plugins: {
      legend: {
        labels: {
          color: textColor,
        },
      },
      tooltip: {
        mode: "index",
        intersect: false,
        callbacks: {
            label: function(context: TooltipItem<"bar">) {
                let label = context.dataset.label || '';
                if (label) {
                    label += ': ';
                }
                if (context.parsed.y !== null) {
                    label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                }
                return label;
            }
        }
      },
    },
    scales: {
      x: {
        ticks: {
          color: textColorSecondary,
          font: {
            weight: 500,
          },
        },
        grid: {
          display: false,
          drawBorder: false,
        },
      },
      y: {
        ticks: {
          color: textColorSecondary,
          callback: function(value: string | number) {
              const val = typeof value === 'string' ? parseFloat(value) : value;
              return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumSignificantDigits: 3 }).format(val);
          }
        },
        grid: {
          color: surfaceBorder,
          drawBorder: false,
        },
      },
    },
  };
});
</script>

<template>
  <div class="h-[300px]">
    <Chart
      type="bar"
      :data="chartData"
      :options="chartOptions"
      class="h-full"
    />
  </div>
</template>
