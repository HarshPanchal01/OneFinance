<script setup lang="ts">
import { computed, ref } from "vue";
import AppChart from "@/components/AppChart.vue";
import { formatDate } from "@/utils";
import { useFormatter } from "@/composables/useFormatter";

const props = defineProps<{
  accountId: string;
  option: string; // "all", "YTD", or specific year
  histories: { accountId: number, date: string, totalValue: number }[];
}>();

const emit = defineEmits<{
  (e: 'point-click', date: string, accountId: string, totalValue: number): void;
}>();

const { formatCurrency } = useFormatter();

const chartDataObj = computed(() => {
  let history = props.histories;

  // Filter by account if a specific one is selected
  if (props.accountId !== 'all') {
    const accId = parseInt(props.accountId);
    history = history.filter(h => h.accountId === accId);
  }

  // Aggregate by date (sum totalValue across accounts for a given day)
  const dateMap = new Map<string, number>();
  for (const entry of history) {
    dateMap.set(entry.date, (dateMap.get(entry.date) || 0) + entry.totalValue);
  }

  let aggregated = Array.from(dateMap.entries()).map(([date, totalValue]) => ({ date, totalValue }));

  // Sort by date ASC
  aggregated.sort((a, b) => a.date.localeCompare(b.date));

  if (aggregated.length > 1) {
    const padded = [];
    for (let i = 0; i < aggregated.length - 1; i++) {
      padded.push(aggregated[i]);
      const currentStr = aggregated[i].date;
      const nextStr = aggregated[i + 1].date;
      
      const current = new Date(currentStr);
      current.setDate(current.getDate() + 1);
      
      while (current.toISOString().split('T')[0] < nextStr) {
        padded.push({
          date: current.toISOString().split('T')[0],
          totalValue: aggregated[i].totalValue
        });
        current.setDate(current.getDate() + 1);
      }
    }
    padded.push(aggregated[aggregated.length - 1]);
    aggregated = padded;
  }

  // Filter by time option
  if (aggregated.length > 0) {
    const isYTD = props.option === "YTD";
    const isAllTime = props.option === "all";
    
    if (isYTD) {
      const now = new Date();
      const twelveMonthsAgoStr = new Date(now.getFullYear(), now.getMonth() - 12, 1).toISOString().split('T')[0];
      aggregated = aggregated.filter(a => a.date >= twelveMonthsAgoStr);
    } else if (!isAllTime) {
      const year = props.option;
      aggregated = aggregated.filter(a => a.date.startsWith(year));
    }
  }

  return aggregated;
});

const chartData = computed(() => {
  const displayTrends = chartDataObj.value;
  const labels = displayTrends.map((t) => {
    // Format to "May 14" etc.
    return new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  const dataTotal = displayTrends.map((t) => t.totalValue);

  return {
    labels,
    datasets: [
      {
        label: "Total Value",
        data: dataTotal,
        // Dynamic area fill: Blue theme
        fill: {
          target: "origin",
          above: "rgba(59, 130, 246, 0.1)", // Light blue fill
          below: "rgba(239, 68, 68, 0.1)",
        },
        borderColor: "#3b82f6", // Neutral Blue
        pointBackgroundColor: "#3b82f6",
        pointBorderColor: "#3b82f6",
        pointBorderWidth: 0,
        tension: 0.3,
        pointRadius: 0, // Hidden by default for clean look
        pointHoverRadius: 6, // Shows on hover to indicate clickable point
        pointHitRadius: 20, // Larger hit area for easier clicking
        borderWidth: 2,
      }
    ],
  };
});

// Helper for delay state
const delayed = ref(false);

const chartOptions = computed(() => {
  return {
    animation: {
      onComplete: () => {
        delayed.value = true;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delay: (context: any) => {
        let delay = 0;
        if (context.type === 'data' && context.mode === 'default' && !delayed.value) {
          delay = context.dataIndex * 5 + context.datasetIndex * 100;
        }
        return delay;
      },
    },
    animations: {
      y: {
        duration: 800,
        easing: "easeOutQuart" as const,
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
      legend: { display: false },
      tooltip: {
        intersect: false,
        mode: 'index' as const,
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 12,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          title: (context: any[]) => {
            const index = context[0].dataIndex;
            const t = chartDataObj.value[index];
            return t ? formatDate(t.date) : '';
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (context: any) => {
            return `Total Value: ${formatCurrency(context.parsed.y)}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxTicksLimit: 8 }
      },
      y: {
        grid: {
          color: 'rgba(156, 163, 175, 0.1)',
        }
      }
    },
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onHover: (_event: any, chartElement: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (_event as any).native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onClick: (_event: any, elements: any[]) => {
      if (elements && elements.length > 0) {
        const index = elements[0].index;
        const t = chartDataObj.value[index];
        if (t) {
          emit('point-click', t.date, props.accountId, t.totalValue);
        }
      }
    }
  };
});
</script>

<template>
  <div class="h-full relative min-h-0">
    <div
      v-if="chartData.labels.length === 0"
      class="h-full w-full flex flex-col items-center justify-center bg-gray-50/50 dark:bg-gray-900/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 absolute inset-0"
    >
      <i class="pi pi-chart-line text-3xl text-gray-300 dark:text-gray-600 mb-2" />
      <p class="text-sm text-gray-500 dark:text-gray-400 text-center px-4">
        No portfolio history available.
      </p>
    </div>
    
    <AppChart
      v-else
      type="line"
      :data="chartData"
      :options="chartOptions"
      height="100%"
    />
  </div>
</template>
