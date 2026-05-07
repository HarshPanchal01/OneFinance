<script setup lang="ts">
import { computed } from "vue";
import { useFinanceStore } from "@/stores/finance";
import AppChart from "@/components/AppChart.vue";
import { getMonthName } from "@/utils";

const props = defineProps<{
  accountId: string;
  option: string; // "all", "YTD", or specific year
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adjustments: any[];
}>();

const store = useFinanceStore();

const investmentAccountIds = computed(() => {
    if (props.accountId !== 'all') {
        return new Set([parseInt(props.accountId)]);
    }
    return new Set(store.accounts.filter(a => {
        const type = store.accountTypes.find(at => at.id === a.accountTypeId);
        return type?.classification === 'investment';
    }).map(a => a.id));
});

const chartData = computed(() => {
  const now = new Date();
  
  const isAllTime = props.option === "all";
  let targetYear = now.getFullYear();
  let startYear = targetYear;
  let endMonth = 12;
  
  if (isAllTime) {
    let earliestYear = now.getFullYear();
    store.transactions.forEach(t => {
      const y = parseInt(t.date.substring(0, 4));
      if (y < earliestYear) earliestYear = y;
    });
    props.adjustments.forEach(adj => {
      const y = parseInt(adj.date.substring(0, 4));
      if (y < earliestYear) earliestYear = y;
    });
    startYear = earliestYear;
    endMonth = now.getMonth() + 1;
  } else if (props.option === "YTD") {
    endMonth = now.getMonth() + 1;
  } else {
    targetYear = parseInt(props.option);
    startYear = targetYear;
  }

  const monthlyNet = new Map<string, number>();
  
  const addNet = (dateStr: string, amount: number) => {
    const ym = dateStr.substring(0, 7); // YYYY-MM
    monthlyNet.set(ym, (monthlyNet.get(ym) || 0) + amount);
  };
  
  for (const t of store.transactions) {
    if (t.type === 'transfer' && t.transferAccountId) {
      const sourceInv = investmentAccountIds.value.has(t.accountId);
      const destInv = investmentAccountIds.value.has(t.transferAccountId);
      if (!sourceInv && destInv) addNet(t.date, t.amount);
      else if (sourceInv && !destInv) addNet(t.date, -t.amount);
    }
  }
  
  for (const adj of props.adjustments) {
    if (investmentAccountIds.value.has(adj.accountId)) {
      if (adj.type === 'income') addNet(adj.date, adj.amount);
      else if (adj.type === 'expense') addNet(adj.date, -adj.amount);
    }
  }

  const spanYears = targetYear - startYear;
  const groupByYear = isAllTime && spanYears > 0;
  
  const labels = [];
  const cumulativeData = [];
  let currentCumulative = 0;
  
  if (isAllTime) {
      if (groupByYear) {
          for (let y = startYear; y <= targetYear; y++) {
              labels.push(y.toString());
              for (let m = 1; m <= 12; m++) {
                  const ym = `${y}-${m.toString().padStart(2, '0')}`;
                  currentCumulative += (monthlyNet.get(ym) || 0);
              }
              cumulativeData.push(currentCumulative);
          }
      } else {
          for (let m = 1; m <= endMonth; m++) {
              labels.push(getMonthName(m).slice(0, 3) + ` ${startYear}`);
              const ym = `${startYear}-${m.toString().padStart(2, '0')}`;
              currentCumulative += (monthlyNet.get(ym) || 0);
              cumulativeData.push(currentCumulative);
          }
      }
  } else {
      // Need base cumulative before startYear
      for (const [ym, net] of monthlyNet.entries()) {
          const y = parseInt(ym.substring(0, 4));
          if (y < startYear) {
              currentCumulative += net;
          }
      }
      
      for (let m = 1; m <= endMonth; m++) {
          labels.push(getMonthName(m).slice(0, 3));
          const ym = `${startYear}-${m.toString().padStart(2, '0')}`;
          currentCumulative += (monthlyNet.get(ym) || 0);
          cumulativeData.push(currentCumulative);
      }
  }

  return {
    labels,
    datasets: [
      {
        label: "Cumulative Contributions",
        data: cumulativeData,
        borderColor: '#3b82f6',
        backgroundColor: '#3b82f633',
        fill: true,
        tension: 0.4,
        pointRadius: groupByYear ? 4 : 2,
        pointHoverRadius: 6,
      }
    ]
  };
});

const chartOptions = computed(() => ({
  plugins: {
    legend: { display: false }
  },
  scales: {
    x: {
      title: { display: true, text: props.option === 'all' && (new Date().getFullYear() - parseInt(chartData.value.labels[0] || '0') > 0) ? 'Year' : 'Month(s)' },
      grid: { display: false }
    },
    y: {
      title: { display: true, text: 'Total Contributions' }
    }
  }
}));
</script>

<template>
  <div class="h-full relative min-h-0">
    <div class="absolute inset-0 pb-2">
      <AppChart
        type="line"
        :data="chartData"
        :options="chartOptions"
        height="100%"
      />
    </div>
  </div>
</template>
