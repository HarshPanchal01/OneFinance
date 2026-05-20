<script setup lang="ts">
import { computed } from "vue";
import { useFinanceStore } from "@/stores/finance";
import AppChart from "@/components/AppChart.vue";
import { useFormatter } from "@/composables/useFormatter";
import { useSettingsStore } from "@/stores/settings";
import { getSectorColor } from "@/utils";

const props = defineProps<{
  accountId: string;
}>();

const emit = defineEmits<{
  (e: 'drill-down', sectorLabel: string): void;
}>();

const store = useFinanceStore();
const { formatCurrency } = useFormatter();
const settingsStore = useSettingsStore();

const chartDataObj = computed(() => {
  const holdings = store.investmentHoldings.filter(h => 
    props.accountId === 'all' || h.accountId === parseInt(props.accountId)
  );

  let targetAccounts = store.accounts.filter(a => {
    const type = store.accountTypes.find(at => at.id === a.accountTypeId);
    return type?.classification === 'investment';
  });

  if (props.accountId !== 'all') {
    const aId = parseInt(props.accountId);
    targetAccounts = targetAccounts.filter(a => a.id === aId);
  }

  let totalUninvestedCash = 0;
  for (const acc of targetAccounts) {
    const accHoldings = store.investmentHoldings.filter(h => h.accountId === acc.id);
    const holdingsValue = accHoldings.reduce((sum, h) => sum + (h.quantity * (h.lastPrice || 0)), 0);
    const cash = (acc.balance || 0) - holdingsValue;
    if (cash > 0) {
      totalUninvestedCash += cash;
    }
  }

  const sectorTotals = new Map<string, number>();

  if (totalUninvestedCash > 0) {
    sectorTotals.set('cash_and_equivalents', totalUninvestedCash);
  }

  holdings.forEach(h => {
    if (h.quantity <= 0) return;
    
    const marketValue = h.quantity * (h.lastPrice || 0);

    if (!h.sectorWeightings) {
      sectorTotals.set('cash_and_equivalents', (sectorTotals.get('cash_and_equivalents') || 0) + marketValue);
      return;
    }

    try {
      const data = JSON.parse(h.sectorWeightings);
      if (!data) {
        sectorTotals.set('cash_and_equivalents', (sectorTotals.get('cash_and_equivalents') || 0) + marketValue);
        return;
      }
      
      let parsedWeights: { sector: string, weight: number }[] = [];
      if (Array.isArray(data)) {
        data.forEach(item => {
          const sector = Object.keys(item)[0];
          parsedWeights.push({ sector, weight: item[sector] });
        });
      } else {
        const sector = Object.keys(data)[0];
        parsedWeights.push({ sector, weight: data[sector] });
      }

      let totalWeight = parsedWeights.reduce((sum, item) => sum + item.weight, 0);

      // Normalize if > 1 to prevent floating point inflation (e.g. 1.000012)
      if (totalWeight > 1) {
          parsedWeights = parsedWeights.map(item => ({ sector: item.sector, weight: item.weight / totalWeight }));
          totalWeight = 1;
      }

      parsedWeights.forEach(item => {
          const sectorValue = marketValue * item.weight;
          sectorTotals.set(item.sector, (sectorTotals.get(item.sector) || 0) + sectorValue);
      });

      if (totalWeight < 1) {
        const remainingWeight = 1 - totalWeight;
        if (remainingWeight > 0.000001) {
          const remainingValue = marketValue * remainingWeight;
          sectorTotals.set('cash_and_equivalents', (sectorTotals.get('cash_and_equivalents') || 0) + remainingValue);
        }
      }
    } catch (e) {
      console.error("Failed to parse sector weightings for", h.symbol, e);
      sectorTotals.set('cash_and_equivalents', (sectorTotals.get('cash_and_equivalents') || 0) + marketValue);
    }
  });

  const sortedSectors = Array.from(sectorTotals.entries())
    .sort((a, b) => b[1] - a[1]);

  const totalValue = sortedSectors.reduce((sum, [, v]) => sum + v, 0);

  const top = sortedSectors.slice(0, 10);
  const others = sortedSectors.slice(10);
  
  if (others.length > 0) {
    const othersValue = others.reduce((sum, [, v]) => sum + v, 0);
    top.push(['others', othersValue]);
  }

  const topSectors = top.map(([s, v]) => {
    let rawName = s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    if (s === 'realestate') rawName = 'Real Estate';
    if (s === 'cash_and_equivalents') rawName = 'Cash & Equivalents';
    if (s === 'others') rawName = 'Others';
    
    let icon = 'pi-briefcase';
    if (s === 'technology') icon = 'pi-desktop';
    else if (s === 'financial_services') icon = 'pi-building-columns';
    else if (s === 'industrials') icon = 'pi-cog';
    else if (s === 'consumer_cyclical') icon = 'pi-shopping-cart';
    else if (s === 'communication_services') icon = 'pi-comments';
    else if (s === 'healthcare') icon = 'pi-heart';
    else if (s === 'energy') icon = 'pi-bolt';
    else if (s === 'consumer_defensive') icon = 'pi-shopping-bag';
    else if (s === 'basic_materials') icon = 'pi-box';
    else if (s === 'utilities' || s === 'realestate') icon = 'pi-home';
    else if (s === 'cash_and_equivalents') icon = 'pi-money-bill';
    else if (s === 'others') icon = 'pi-ellipsis-h';

    return {
      sectorName: rawName,
      total: v,
      percentage: totalValue > 0 ? (v / totalValue) * 100 : 0,
      color: s === 'others' ? '#9ca3af' : getSectorColor(rawName),
      icon
    };
  });

  return {
    topSectors,
    totalValue
  };
});

const chartData = computed(() => {
  return {
    labels: chartDataObj.value.topSectors.map(s => s.sectorName),
    datasets: [
      {
        data: chartDataObj.value.topSectors.map(s => s.total),
        backgroundColor: chartDataObj.value.topSectors.map(s => s.color),
        hoverBackgroundColor: chartDataObj.value.topSectors.map(s => s.color + '99'),
        borderColor: chartDataObj.value.topSectors.map(s => s.color),
        hoverBorderColor: chartDataObj.value.topSectors.map(s => s.color),
        borderWidth: 2,
        hoverOffset: 6,
      }
    ]
  };
});

const chartOptions = computed(() => ({
  layout: {
    padding: 8
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (context: any) => {
            const val = context.raw;
            const total = chartDataObj.value.totalValue;
            const percent = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
            if (settingsStore.privacyMode) return `${context.label}: ***`;
            return `${context.label}: ${formatCurrency(val)} (${percent}%)`;
        }
      }
      }
      },
      onClick: (_event: any, elements: any[]) => {
      if (elements && elements.length > 0) {
      const index = elements[0].index;
      const sectorLabel = chartData.value.labels[index];
      if (sectorLabel) {
      emit('drill-down', sectorLabel);
      }
      }
      },
      onHover: (_event: any, chartElement: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (_event as any).native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
      }
      }));
      </script>
<template>
  <div class="h-full relative min-h-0">
    <div
      v-if="chartData.datasets[0].data.length === 0"
      class="h-full w-full flex flex-col items-center justify-center bg-gray-50/50 dark:bg-gray-900/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 absolute inset-0"
    >
      <i class="pi pi-globe text-3xl text-gray-300 dark:text-gray-600 mb-2" />
      <p class="text-sm text-gray-500 dark:text-gray-400 text-center px-4">
        No sector data available.
      </p>
      <p class="text-[10px] text-gray-400 dark:text-gray-500 text-center px-6 mt-1">
        Sector data is fetched when you add or refresh prices.
      </p>
    </div>
    
    <div
      v-else
      class="flex flex-col xl:flex-row h-full w-full items-center xl:justify-between gap-4"
    >
      <!-- Left Column: Title + Total Text + Chart -->
      <div class="flex flex-col items-center justify-start gap-0 shrink-0 flex-1 min-w-0 mt-[-32px]">
        <h3 class="font-semibold text-gray-700 dark:text-gray-200 text-sm lg:text-base mb-1 lg:self-start xl:self-center whitespace-nowrap">
          <span class="lg:hidden xl:inline">Sector Diversification</span>
          <span class="hidden lg:inline xl:hidden">Sectors</span>
        </h3>

        <!-- Total Text (Above Chart) -->
        <div class="flex flex-col items-center justify-center mb-2">
          <span class="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase leading-tight mb-0.5">Total</span>
          <span
            class="text-base xl:text-xl font-bold text-gray-800 dark:text-white"
            :class="{ 'privacy-blur': settingsStore.privacyMode }"
          >{{ formatCurrency(chartDataObj.totalValue) }}</span>
        </div>

        <!-- Chart -->
        <div class="relative w-52 h-52 xl:w-60 xl:h-60">
          <AppChart
            type="pie"
            :data="chartData"
            :options="chartOptions"
            height="100%"
            :currency-format="false"
          />
        </div>
      </div>

      <!-- Custom Legend (Right Side - Hidden on small screens) -->
      <div class="hidden xl:flex overflow-y-auto h-full pr-1 space-y-2.5 pt-8 pb-2 flex-col w-28 shrink-0">
        <div
          v-for="cat in chartDataObj.topSectors"
          :key="cat.sectorName"
          class="flex items-center gap-2.5 cursor-pointer p-1 transition-colors"
          :title="cat.sectorName"
          @click="emit('drill-down', cat.sectorName)"
        >
          <div
            class="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
            :style="{ backgroundColor: cat.color + '20' }"
          >
            <i
              :class="['pi', cat.icon]"
              :style="{ color: cat.color, fontSize: '10px' }"
            />
          </div>
          <div class="flex flex-col min-w-0">
            <span class="text-[11px] font-semibold text-gray-700 dark:text-gray-200 truncate">
              {{ cat.sectorName }}
            </span>
            <span class="text-[10px] text-gray-400 font-medium">
              {{ cat.percentage.toFixed(1) }}%
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
