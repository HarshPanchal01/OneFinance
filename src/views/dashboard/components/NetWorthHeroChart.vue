<script setup lang="ts">
import { computed } from "vue";
import { useFinanceStore } from "@/stores/finance";
import { useSettingsStore } from "@/stores/settings";
import AppChart from "@/components/AppChart.vue";

const store = useFinanceStore();
const settingsStore = useSettingsStore();

// The net-worth "journey": the monthly trend, ending at the current total so the
// line's last point matches the headline figure. Decorative background — no axes,
// no tooltips; the gradient fades to the card behind it.
const chartData = computed(() => {
  const trends = store.netWorthTrends;
  const balances = trends.map((t) => t.balance);
  const labels = trends.map((t) => `${t.month}/${t.year}`);

  const currentNetWorth = store.accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  balances.push(currentNetWorth);
  labels.push("Today");
  const lastIndex = balances.length - 1;

  return {
    labels,
    datasets: [
      {
        data: balances,
        borderColor: "#0ea5e9",
        borderWidth: 2.5,
        tension: 0.4,
        fill: "origin" as const,
        backgroundColor: (ctx: any) => {
          const area = ctx.chart.chartArea;
          if (!area) return "rgba(14, 165, 233, 0.18)";
          const g = ctx.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
          g.addColorStop(0, "rgba(14, 165, 233, 0.30)");
          g.addColorStop(1, "rgba(14, 165, 233, 0)");
          return g;
        },
        pointRadius: (ctx: any) => (ctx.dataIndex === lastIndex ? 4 : 0),
        pointHoverRadius: (ctx: any) => (ctx.dataIndex === lastIndex ? 4 : 0),
        pointBackgroundColor: "#0ea5e9",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
      },
    ],
  };
});

function abbreviate(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${sign}$${Math.round(abs / 1000)}k`;
  return `${sign}$${Math.round(abs)}`;
}

const chartOptions = computed(() => ({
  maintainAspectRatio: false,
  layout: { padding: { right: 6 } },
  animation: { duration: 800, easing: "easeOutQuart" as const },
  plugins: {
    legend: { display: false },
    tooltip: { enabled: false },
  },
  scales: {
    x: { display: false, grid: { display: false } },
    // A few currency labels on the right edge, like Wealthsimple.
    y: {
      position: "right" as const,
      beginAtZero: true,
      grid: { display: false },
      border: { display: false },
      ticks: {
        maxTicksLimit: 5,
        padding: 8,
        font: { size: 13, weight: 600 as const },
        callback: (value: any) => (settingsStore.privacyMode ? "" : abbreviate(Number(value))),
      },
    },
  },
}));
</script>

<template>
  <AppChart
    type="line"
    :data="chartData"
    :options="chartOptions"
    :currency-format="false"
    height="100%"
  />
</template>
