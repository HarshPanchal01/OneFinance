<script setup lang="ts">
import { computed } from "vue";
import { useFinanceStore } from "@/stores/finance";
import AppChart from "@/components/AppChart.vue";
import { getMonthName, toIsoDateString } from "@/utils";

const props = defineProps<{
  accountId: string;
  option: string; // "YTD" or specific year
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
  const startMonth = 1;
  let endMonth = 12;
  let targetYear = now.getFullYear();

  if (props.option === "YTD") {
    endMonth = now.getMonth() + 1; // current month
  } else {
    targetYear = parseInt(props.option);
  }

  const labels = [];
  const netData = [];

  for (let month = startMonth; month <= endMonth; month++) {
    labels.push(getMonthName(month).slice(0, 3));
    
    // Calculate net for this month
    let net = 0;
    const monthStart = toIsoDateString(new Date(targetYear, month - 1, 1));
    const monthEnd = toIsoDateString(new Date(targetYear, month, 0));

    // Transfers
    for (const t of store.transactions) {
        if (t.date >= monthStart && t.date <= monthEnd && t.type === 'transfer' && t.transferAccountId) {
            const sourceInv = investmentAccountIds.value.has(t.accountId);
            const destInv = investmentAccountIds.value.has(t.transferAccountId);
            
            if (!sourceInv && destInv) net += t.amount; // Inflow to investments
            else if (sourceInv && !destInv) net -= t.amount; // Outflow
        }
    }

    // Adjustments
    for (const adj of props.adjustments) {
        if (adj.date >= monthStart && adj.date <= monthEnd && investmentAccountIds.value.has(adj.accountId)) {
            if (adj.type === 'income') net += adj.amount;
            else if (adj.type === 'expense') net -= adj.amount;
        }
    }

    netData.push(net);
  }

  return {
    labels,
    datasets: [
      {
        label: "Net Contributions",
        data: netData,
        backgroundColor: netData.map(v => v >= 0 ? "#0ea5e9" : "#ef4444"), // Blue for positive deposit, Red for withdrawal
        hoverBackgroundColor: netData.map(v => v >= 0 ? "#0ea5e999" : "#ef444499"),
        borderRadius: 4,
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
      title: { display: true, text: 'Month(s)' },
      grid: { display: false }
    },
    y: {
      title: { display: true, text: 'Amount' }
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
