<script setup lang="ts">
import { computed, ref } from "vue";
import AppChart from "@/components/AppChart.vue";
import { formatDate } from "@/utils";
import { useFormatter } from "@/composables/useFormatter";
import { useSettingsStore } from "@/stores/settings";
import { useFinanceStore } from "@/stores/finance";

const props = defineProps<{
  accountId: string;
  dateRange: { startDate: string, endDate: string };
  histories: { accountId: number, date: string, totalValue: number }[];
}>();

const emit = defineEmits<{
  (e: 'point-click', date: string, accountId: string, totalValue: number): void;
}>();

const { formatCurrency } = useFormatter();
const settingsStore = useSettingsStore();
const store = useFinanceStore();

// Helper to determine if an account is an investment account
const investmentAccountIds = computed(() => new Set(store.accounts.filter(a => {
  const type = store.accountTypes.find(at => at.id === a.accountTypeId);
  return type?.classification === 'investment';
}).map(a => a.id)));

const isInvestment = (id: number) => investmentAccountIds.value.has(id);

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

  // Filter by date range
  if (aggregated.length > 0) {
    aggregated = aggregated.filter(a => 
      a.date >= props.dateRange.startDate && 
      a.date <= props.dateRange.endDate
    );
  }

  // Calculate Benchmark (Net Invested Capital)
  if (aggregated.length === 0) return [];
  
  const startValue = aggregated[0].totalValue;
  const startDate = aggregated[0].date;
  const endDate = aggregated[aggregated.length - 1].date;

  // Track transactions affecting the benchmark
  const txMap = new Map<string, number>();
  store.transactions.forEach(t => {
      if (t.date < startDate || t.date > endDate) return;
      if (t.type !== 'transfer' || !t.transferAccountId) return;
      
      const sourceInv = isInvestment(t.accountId);
      const destInv = isInvestment(t.transferAccountId);
      let amount = 0;
      
      if (props.accountId !== 'all') {
          const accId = parseInt(props.accountId);
          if (!sourceInv && t.transferAccountId === accId) amount += t.amount;
          if (t.accountId === accId && !destInv) amount -= t.amount;
      } else {
          if (!sourceInv && destInv) amount += t.amount;
          if (sourceInv && !destInv) amount -= t.amount;
      }

      if (amount !== 0) {
          txMap.set(t.date, (txMap.get(t.date) || 0) + amount);
      }
  });

  let cumulativeExtra = 0;
  return aggregated.map((day, index) => {
      // We start the benchmark at the first day's total value.
      // We only add contributions that happen AFTER the first day's snapshot.
      if (index > 0) {
          cumulativeExtra += (txMap.get(day.date) || 0);
      }
      return {
          ...day,
          benchmark: startValue + cumulativeExtra
      };
  });
});

const chartData = computed(() => {
  const displayTrends = chartDataObj.value;
  const labels = displayTrends.map((t) => {
    // Format to "May 14" etc.
    return new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  const dataTotal = displayTrends.map((t) => t.totalValue);
  const dataBenchmark = displayTrends.map((t) => (t as any).benchmark);

  return {
    labels,
    datasets: [
      {
        label: "Invested Capital",
        data: dataBenchmark,
        borderColor: "rgba(107, 114, 128, 0.8)", // Gray-500
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
        tension: 0.1,
      },
      {
        label: "Total Value",
        data: dataTotal,
        // Comparison fill: Green above capital, Red below
        fill: {
          target: 0, // Target the "Invested Capital" dataset (index 0)
          above: "rgba(34, 197, 94, 0.15)", // Light green
          below: "rgba(239, 68, 68, 0.15)",  // Light red
        },
        borderColor: "#3b82f6", // Neutral Blue
        pointBackgroundColor: "#3b82f6",
        pointBorderColor: "#3b82f6",
        pointBorderWidth: 0,
        tension: 0.3,
        // Dynamic point visibility: Show all if <= 31 (a month), otherwise show a subset to indicate interactivity
        pointRadius: (context: any) => {
           if (context.datasetIndex === 0) return 0; // No points for benchmark
           const count = context.dataset.data.length;
           if (count <= 31) return 4;
           
           // For longer ranges, show roughly 10 points spread out
           const step = Math.floor(count / 10);
           return context.dataIndex % step === 0 ? 4 : 0;
        },
        pointHoverRadius: 7,
        pointHitRadius: 20,
        borderWidth: 2,
      }
    ],
  };
});

// Helper for delay state
const delayed = ref(false);

const chartOptions = computed(() => {
  // Track privacyMode for reactivity
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  settingsStore.privacyMode;

  return {
    animation: {
      onComplete: () => {
        delayed.value = true;
      },
       
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
         
        from: (ctx: any) => {
          if (!delayed.value && ctx.chart.scales.y) {
            return ctx.chart.scales.y.getPixelForValue(0);
          }
          return undefined;
        },
      },
    },
    plugins: {
      legend: { 
        display: false, // Using custom legend in parent for consistency
      },
      tooltip: {
        intersect: false,
        mode: 'index' as const,
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 12,
        cornerRadius: 8,
        displayColors: true, // Enable colors to distinguish lines
        callbacks: {
           
          title: (context: any[]) => {
            const index = context[0].dataIndex;
            const t = chartDataObj.value[index];
            return t ? formatDate(t.date) : '';
          },
           
          labelTextColor: (context: any) => {
            // Index 0 is Invested Capital, make it darker grey
            if (context.datasetIndex === 0) return 'rgba(156, 163, 175, 1)'; // Gray-400
            return '#fff';
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxTicksLimit: 8 },
        title: {
          display: true,
          text: 'Date',
          color: 'rgba(156, 163, 175, 0.8)',
          font: { size: 13, weight: 'bold' }
        }
      },
      y: {
        grid: {
          color: 'rgba(156, 163, 175, 0.1)',
        },
        title: {
          display: true,
          text: 'Total Value',
          color: 'rgba(156, 163, 175, 0.8)',
          font: { size: 13, weight: 'bold' }
        },
        ticks: {
          callback: function(value: any) {
            if (settingsStore.privacyMode) return '***';
            return formatCurrency(value);
          }
        }
      }
    },
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
     
    onHover: (_event: any, chartElement: any) => {
       
      (_event as any).native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
    },
     
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
