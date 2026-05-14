<script setup lang="ts">
import { computed } from "vue";
import { useFinanceStore } from "@/stores/finance";
import AppChart from "@/components/AppChart.vue";
import { useFormatter } from "@/composables/useFormatter";
import { useSettingsStore } from "@/stores/settings";

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

  const sectorTotals = new Map<string, number>();

  holdings.forEach(h => {
    if (!h.sectorWeightings || h.quantity <= 0) return;
    
    const marketValue = h.quantity * (h.lastPrice || 0);
    try {
      const data = JSON.parse(h.sectorWeightings);
      if (!data) return;
      
      if (Array.isArray(data)) {
        // ETF Format: [{ "technology": 0.25 }, ...]
        data.forEach(item => {
          const sector = Object.keys(item)[0];
          const weight = item[sector];
          const sectorValue = marketValue * weight;
          sectorTotals.set(sector, (sectorTotals.get(sector) || 0) + sectorValue);
        });
      } else {
        // Stock Format: { "technology": 1 }
        const sector = Object.keys(data)[0];
        const weight = data[sector];
        const sectorValue = marketValue * weight;
        sectorTotals.set(sector, (sectorTotals.get(sector) || 0) + sectorValue);
      }
    } catch (e) {
      console.error("Failed to parse sector weightings for", h.symbol, e);
    }
  });

  const sortedSectors = Array.from(sectorTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10); // Keep top 10

  const totalValue = sortedSectors.reduce((sum, [, v]) => sum + v, 0);

  const baseColors = [
    '#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', 
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
  ];

  const topSectors = sortedSectors.map(([s, v], index) => {
    const rawName = s === 'realestate' ? 'Real Estate' : s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    
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
    else if (s === 'utilities') icon = 'pi-home';
    else if (s === 'realestate') icon = 'pi-home';

    return {
      sectorName: rawName,
      total: v,
      percentage: totalValue > 0 ? (v / totalValue) * 100 : 0,
      color: baseColors[index % baseColors.length],
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
