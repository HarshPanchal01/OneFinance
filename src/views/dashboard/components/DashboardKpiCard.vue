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
    icon?: string;
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

const accentClasses = computed(() => {
  switch (props.accent) {
    case "income":
      return { text: "text-income", bg: "bg-income-light dark:bg-income/20" };
    case "expense":
      return { text: "text-expense", bg: "bg-expense-light dark:bg-expense/20" };
    case "primary":
      return { text: "text-primary-500", bg: "bg-primary-100 dark:bg-primary-500/20" };
    default:
      return { text: "text-gray-500 dark:text-gray-400", bg: "bg-gray-100 dark:bg-gray-700" };
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

// Smoothed, filled area sparkline (no Chart.js needed for 4 tiny series).
const SPARK_W = 100;
const SPARK_H = 30;
const sparkPaths = computed(() => {
  const data = props.sparkline;
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = SPARK_W / (data.length - 1);
  const pad = 2; // keep the stroke off the top/bottom edges
  const pts = data.map((v, i) => ({
    x: i * stepX,
    y: pad + (SPARK_H - 2 * pad) * (1 - (v - min) / range),
  }));

  // Quadratic smoothing through segment midpoints.
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
    class="card p-4 flex flex-col"
  >
    <div class="flex items-start justify-between">
      <p class="text-sm font-medium text-gray-500 dark:text-gray-400">
        {{ label }}
      </p>
      <div
        v-if="icon"
        class="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        :class="accentClasses.bg"
      >
        <i :class="['pi', icon, accentClasses.text]" />
      </div>
    </div>

    <p
      class="text-2xl font-bold text-gray-900 dark:text-white mt-1"
      :class="{ 'privacy-blur': settingsStore.privacyMode }"
    >
      {{ formatCurrency(value) }}
    </p>

    <div class="min-h-[1.5rem] mt-1 flex items-center">
      <span
        v-if="hasDelta"
        class="inline-flex items-center text-sm font-semibold whitespace-nowrap"
        :class="deltaClass"
      >
        <i
          v-if="!deltaIsZero"
          class="pi text-xs mr-1"
          :class="deltaUp ? 'pi-arrow-up' : 'pi-arrow-down'"
        />
        {{ deltaAbs.toFixed(1) }}%
        <span class="text-gray-400 dark:text-gray-500 font-normal ml-1">vs previous period</span>
      </span>
    </div>

    <svg
      v-if="sparkPaths"
      :viewBox="`0 0 ${SPARK_W} ${SPARK_H}`"
      preserveAspectRatio="none"
      class="w-full h-8 mt-2"
      :class="[accentClasses.text, { 'privacy-blur': settingsStore.privacyMode }]"
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
</template>
