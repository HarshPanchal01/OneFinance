<script setup lang="ts">
import { computed } from "vue";
import Chart from "primevue/chart";
import type { TooltipItem, ChartOptions, ChartData } from "chart.js";
import { useSettingsStore } from "@/stores/settings";

interface Props {
  type: "bar" | "line" | "doughnut" | "pie" | "polarArea" | "radar";
  data: ChartData;
  options?: ChartOptions;
  height?: string;
  currencyFormat?: boolean;
  plugins?: any[];
}

const props = withDefaults(defineProps<Props>(), {
  options: () => ({}),
  height: "300px",
  currencyFormat: true,
  plugins: () => [],
});

const settingsStore = useSettingsStore();

const defaultOptions = computed(() => {
  const textColor = settingsStore.isDark ? "#f3f4f6" : "#111827"; // gray-100 or gray-900
  const gridColor = settingsStore.isDark ? "#374151" : "#e5e7eb"; // gray-700 or gray-200

  const base: ChartOptions = {
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: textColor,
        },
      },
      tooltip: {
        mode: props.type === 'doughnut' || props.type === 'pie' ? 'nearest' : 'index',
        intersect: props.type === 'doughnut' || props.type === 'pie' ? true : false,
        callbacks: {},
      },
    },
    scales: {},
    interaction: {
        mode: 'nearest',
        axis: props.type === 'doughnut' || props.type === 'pie' ? undefined : 'x',
        intersect: props.type === 'doughnut' || props.type === 'pie' ? true : false
    }
  };

  // Add Currency Formatting to Tooltips
  if (props.currencyFormat) {
    base.plugins!.tooltip!.callbacks!.label = function(context: TooltipItem<"bar" | "line" | "doughnut" | "pie" | "polarArea" | "radar">) {
        let label = context.dataset.label || '';
        if (label) {
            label += ': ';
        }
        
        if (settingsStore.privacyMode) {
            label += '***';
            return label;
        }

        const localeParts = settingsStore.resolvedLocale.split('-');
        const forcedLocale = localeParts.length > 1 ? `en-${localeParts[1]}` : 'en-US';

        if (context.parsed.y !== null && context.parsed.y !== undefined) {
             // For Bar/Line charts where data is x/y
            label += new Intl.NumberFormat(forcedLocale, { style: 'currency', currency: settingsStore.currency, currencyDisplay: 'narrowSymbol' }).format(context.parsed.y);
        } else if (context.raw !== null && context.raw !== undefined && (props.type === 'doughnut' || props.type === 'pie')) {
            // For Doughnut/Pie where data is just a number in raw
            const val = context.raw as number;
            label += new Intl.NumberFormat(forcedLocale, { style: 'currency', currency: settingsStore.currency, currencyDisplay: 'narrowSymbol' }).format(val);
            
            // Calculate percentage
            const meta = context.chart.getDatasetMeta(context.datasetIndex);
            const total = (meta as unknown as { total: number }).total;
            if (total > 0) {
                const percentage = ((val / total) * 100).toFixed(1);
                label += ` (${percentage}%)`;
            }
        }
        return label;
    };
  }

  // Add Scales Configuration (only for cartesian charts)
  if (['bar', 'line'].includes(props.type)) {
    base.scales = {
      x: {
        ticks: {
          color: textColor,
          font: {
            weight: 500,
          },
        },
        grid: {
          display: false,
        },
        title: {
            display: false, // Default to false, components can override
            color: textColor,
            font: {
                weight: 600
            }
        }
      },
      y: {
        ticks: {
          color: textColor,
          callback: function(value: string | number) {
              if (settingsStore.privacyMode) {
                  return '***';
              }
              if (props.currencyFormat) {
                const val = typeof value === 'string' ? parseFloat(value) : value;
                const localeParts = settingsStore.resolvedLocale.split('-');
                const forcedLocale = localeParts.length > 1 ? `en-${localeParts[1]}` : 'en-US';
                return new Intl.NumberFormat(forcedLocale, { style: 'currency', currency: settingsStore.currency, currencyDisplay: 'narrowSymbol', maximumSignificantDigits: 3 }).format(val);
              }
              return value;
          }
        },
        grid: {
          color: gridColor,
        },
        title: {
            display: false, // Default to false
            color: textColor,
            font: {
                weight: 600
            }
        }
      },
    };
  } else {
      // Clear scales for radial charts to avoid errors if merged improperly
      delete base.scales;
  }

  return base;
});

// Deep merge options (simple version)
const chartOptions = computed(() => {
  const merged = { ...defaultOptions.value, ...props.options };
  
  // Merge plugins deep-ish
  if (props.options.plugins) {
      merged.plugins = { ...defaultOptions.value.plugins, ...props.options.plugins };
      // Deep merge tooltip
      if (props.options.plugins.tooltip && defaultOptions.value.plugins?.tooltip) {
         merged.plugins.tooltip = { ...defaultOptions.value.plugins.tooltip, ...props.options.plugins.tooltip };
      }
      // Deep merge legend
      if (props.options.plugins.legend && defaultOptions.value.plugins?.legend) {
         merged.plugins.legend = { ...defaultOptions.value.plugins.legend, ...props.options.plugins.legend };
      }
  }
  
  // Merge scales deep-ish
  if (props.options.scales && defaultOptions.value.scales) {
      merged.scales = { ...defaultOptions.value.scales };
      for (const key of Object.keys(props.options.scales)) {
          const defaultScale = (defaultOptions.value.scales as any)[key] || {};
          const propScale = (props.options.scales as any)[key] || {};
          
          (merged.scales as any)[key] = {
              ...defaultScale,
              ...propScale
          };
          
          // Deep merge title explicitly
          if (propScale.title || defaultScale.title) {
              (merged.scales as any)[key].title = {
                  ...(defaultScale.title || {}),
                  ...(propScale.title || {}),
                  color: (defaultOptions.value.scales as any)[key]?.title?.color || (settingsStore.isDark ? "#f3f4f6" : "#111827")
              };
          }
          
          // Deep merge ticks explicitly
          if (propScale.ticks || defaultScale.ticks) {
              (merged.scales as any)[key].ticks = {
                  ...(defaultScale.ticks || {}),
                  ...(propScale.ticks || {}),
                  color: (defaultOptions.value.scales as any)[key]?.ticks?.color || (settingsStore.isDark ? "#f3f4f6" : "#111827")
              };
          }
          
          // Deep merge grid explicitly
          if (propScale.grid && defaultScale.grid) {
              (merged.scales as any)[key].grid = {
                  ...defaultScale.grid,
                  ...propScale.grid
              };
          }
      }
  }

  return merged;
});
</script>

<template>
  <div :style="{ height: height }">
    <Chart
      :type="type"
      :data="data"
      :options="chartOptions"
      :plugins="plugins"
      class="h-full"
    />
  </div>
</template>
