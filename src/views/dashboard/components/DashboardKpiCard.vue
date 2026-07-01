<script setup lang="ts">
import { computed } from "vue";
import Tooltip from "primevue/tooltip";
import { useSettingsStore } from "@/stores/settings";
import { useFormatter } from "@/composables/useFormatter";

const vTooltip = Tooltip;

const props = withDefaults(
  defineProps<{
    label: string;
    value: number;
    delta?: number | null;
    // For expenses, a decrease is good — invert the delta colouring.
    positiveIsGood?: boolean;
    sparkline?: number[];
    accent?: "income" | "expense" | "primary" | "neutral";
    tooltip?: string;
  }>(),
  {
    delta: null,
    positiveIsGood: true,
    accent: "neutral",
  }
);

const settingsStore = useSettingsStore();
const { formatCurrency } = useFormatter();

const accentText = computed(() => {
  switch (props.accent) {
    case "income":
      return "text-income";
    case "expense":
      return "text-expense";
    case "primary":
      return "text-primary-500";
    default:
      return "text-gray-500 dark:text-gray-400";
  }
});

const hasDelta = computed(
  () => props.delta !== null && props.delta !== undefined && isFinite(props.delta)
);
const deltaIsZero = computed(() => hasDelta.value && props.delta === 0);
const deltaUp = computed(() => hasDelta.value && (props.delta as number) > 0);
const deltaAbs = computed(() => (hasDelta.value ? Math.abs(props.delta as number) : 0));

const deltaClass = computed(() => {
  if (!hasDelta.value || deltaIsZero.value) return "text-gray-400 dark:text-gray-500";
  return deltaUp.value === props.positiveIsGood ? "text-income" : "text-expense";
});

// Smoothed, filled area sparkline that fills the card's right-hand space.
const SPARK_W = 100;
const SPARK_H = 28;
const sparkPaths = computed(() => {
  const data = props.sparkline;
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = SPARK_W / (data.length - 1);
  const pad = 2;
  const pts = data.map((v, i) => ({
    x: i * stepX,
    y: pad + (SPARK_H - 2 * pad) * (1 - (v - min) / range),
  }));

  let line = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    line += ` Q ${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  line += ` L ${last.x.toFixed(1)},${last.y.toFixed(1)}`;

  const area = `${line} L ${last.x.toFixed(1)},${SPARK_H} L ${pts[0].x.toFixed(1)},${SPARK_H} Z`;
  return { line, area };
});
</script>

<template>
  <div
    v-tooltip.bottom="tooltip"
    class="card p-4 flex items-center gap-4"
  >
    <div class="min-w-0 shrink-0">
      <p class="text-sm font-medium text-gray-500 dark:text-gray-400">
        {{ label }}
      </p>
      <p
        class="text-2xl font-bold text-gray-900 dark:text-white mt-1 whitespace-nowrap"
        :class="{ 'privacy-blur': settingsStore.privacyMode }"
      >
        {{ formatCurrency(value) }}
      </p>
      <div class="mt-0.5 min-h-[1.25rem] flex items-center">
        <span
          v-if="hasDelta"
          class="inline-flex items-center text-xs font-semibold whitespace-nowrap"
          :class="deltaClass"
        >
          <i
            v-if="!deltaIsZero"
            class="pi text-[10px] mr-1"
            :class="deltaUp ? 'pi-arrow-up' : 'pi-arrow-down'"
          />
          {{ deltaAbs.toFixed(1) }}%
          <span class="text-gray-400 dark:text-gray-500 font-normal ml-1">vs previous period</span>
        </span>
      </div>
    </div>

    <div
      v-if="sparkPaths"
      class="flex-1 min-w-0 h-12 self-center"
      :class="{ 'privacy-blur': settingsStore.privacyMode }"
    >
      <svg
        :viewBox="`0 0 ${SPARK_W} ${SPARK_H}`"
        preserveAspectRatio="none"
        class="w-full h-full"
        :class="accentText"
      >
        <path
          :d="sparkPaths.area"
          fill="currentColor"
          fill-opacity="0.12"
          stroke="none"
        />
        <path
          :d="sparkPaths.line"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
      </svg>
    </div>
  </div>
</template>
