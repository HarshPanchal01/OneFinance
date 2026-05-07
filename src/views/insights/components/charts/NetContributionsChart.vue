<script setup lang="ts">
import { computed } from "vue";
import { useFinanceStore } from "@/stores/finance";
import AppChart from "@/components/AppChart.vue";
import { getMonthName } from "@/utils";

const props = defineProps<{
  accountId: string;
  option: string; // "all", "YTD", or specific year
}>();

  const emit = defineEmits<{
  (e: 'drill-down', data: { range: { fromDate: string, toDate: string }, type: 'deposit' | 'withdrawal' }): void;
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
  const isYTD = props.option === "YTD";
  let targetYear = now.getFullYear();
  let startYear = targetYear;
  let endMonth = 12;
  let startMonth = 1;
  
  if (isAllTime) {
    let earliestYear = now.getFullYear();
    store.transactions.forEach(t => {
      const y = parseInt(t.date.substring(0, 4));
      if (y < earliestYear) earliestYear = y;
    });
    startYear = earliestYear;
    endMonth = now.getMonth() + 1;
  } else if (isYTD) {
    const elevenMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    startYear = elevenMonthsAgo.getFullYear();
    startMonth = elevenMonthsAgo.getMonth() + 1;
    targetYear = now.getFullYear();
    endMonth = now.getMonth() + 1;
  } else {
    targetYear = parseInt(props.option);
    startYear = targetYear;
  }

  const monthlyDeposits = new Map<string, number>();
  const monthlyWithdrawals = new Map<string, number>();
  
  const spanYears = targetYear - startYear;
  const groupByYear = isAllTime && spanYears > 0;
  
  const addDeposit = (dateStr: string, amount: number) => {
    const key = groupByYear ? dateStr.substring(0, 4) : dateStr.substring(0, 7);
    monthlyDeposits.set(key, (monthlyDeposits.get(key) || 0) + amount);
  };
  const addWithdrawal = (dateStr: string, amount: number) => {
    const key = groupByYear ? dateStr.substring(0, 4) : dateStr.substring(0, 7);
    monthlyWithdrawals.set(key, (monthlyWithdrawals.get(key) || 0) - amount); // Store as negative for downward bar
  };
  
  for (const t of store.transactions) {
    if (t.type === 'transfer' && t.transferAccountId) {
      const sourceInv = investmentAccountIds.value.has(t.accountId);
      const destInv = investmentAccountIds.value.has(t.transferAccountId);
      if (!sourceInv && destInv) addDeposit(t.date, t.amount);
      else if (sourceInv && !destInv) addWithdrawal(t.date, t.amount);
    }
  }
  
  const labels = [];
  const depositsData = [];
  const withdrawalsData = [];
  const metaRanges = [];
  
  if (groupByYear) {
      for (let y = startYear; y <= targetYear; y++) {
          labels.push(y.toString());
          depositsData.push(monthlyDeposits.get(y.toString()) || 0);
          withdrawalsData.push(monthlyWithdrawals.get(y.toString()) || 0);
          metaRanges.push({ fromDate: `${y}-01-01`, toDate: `${y}-12-31` });
      }
  } else {
      let currentY = startYear;
      let currentM = startMonth;
      while (currentY < targetYear || (currentY === targetYear && currentM <= endMonth)) {
          const ym = `${currentY}-${currentM.toString().padStart(2, '0')}`;
          labels.push(getMonthName(currentM).slice(0, 3) + (isAllTime ? ` ${currentY}` : ''));
          depositsData.push(monthlyDeposits.get(ym) || 0);
          withdrawalsData.push(monthlyWithdrawals.get(ym) || 0);
          const lastDay = new Date(currentY, currentM, 0).getDate();
          metaRanges.push({ fromDate: `${ym}-01`, toDate: `${ym}-${lastDay.toString().padStart(2, '0')}` });
          
          currentM++;
          if (currentM > 12) {
              currentM = 1;
              currentY++;
          }
      }
  }

  return {
    labels,
    metaRanges,
    datasets: [
      {
        label: "Deposits",
        data: depositsData,
        backgroundColor: "#22c55e", // Green
        hoverBackgroundColor: "#22c55e99",
        borderColor: "#22c55e",
        hoverBorderColor: "#22c55e",
        borderWidth: 2,
        borderRadius: 4,
      },
      {
        label: "Withdrawals",
        data: withdrawalsData,
        backgroundColor: "#ef4444", // Red
        hoverBackgroundColor: "#ef444499",
        borderColor: "#ef4444",
        hoverBorderColor: "#ef4444",
        borderWidth: 2,
        borderRadius: 4,
      }
    ]
  };
});

const chartOptions = computed(() => ({
  plugins: {
    legend: { display: false },
    tooltip: { borderWidth: 0 }
  },
  scales: {
    x: {
      stacked: true,
      title: { display: true, text: props.option === 'all' && (new Date().getFullYear() - parseInt(chartData.value.labels[0] || '0') > 0) ? 'Year' : 'Month(s)' },
      grid: { display: false }
    },
    y: {
      stacked: true,
      title: { display: true, text: 'Amount' }
    }
  },
  onHover: (_event: any, chartElement: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (_event as any).native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
  },
  onClick: (_event: any, elements: any[]) => {
    if (elements && elements.length > 0) {
      const index = elements[0].index;
      const datasetIndex = elements[0].datasetIndex;
      const range = chartData.value.metaRanges[index];
      if (range) {
        emit('drill-down', { range, type: datasetIndex === 0 ? 'deposit' : 'withdrawal' });
      }
    }
  }
}));
</script>

<template>
  <div class="h-full relative min-h-0">
    <div class="absolute inset-0 pb-2">
      <AppChart
        type="bar"
        :data="chartData"
        :options="chartOptions"
        height="100%"
      />
    </div>
  </div>
</template>