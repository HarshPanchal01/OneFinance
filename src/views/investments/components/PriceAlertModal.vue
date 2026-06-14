<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from "vue";
import { useFinanceStore } from "@/stores/finance";
import { InvestmentHolding } from "@/types";

const props = defineProps<{
  visible: boolean;
  holding: InvestmentHolding | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const store = useFinanceStore();

type Row = { key: 'alertDailyPct' | 'alertWeeklyPct' | 'alertMonthlyPct'; label: string; hint: string };
const rows: Row[] = [
  { key: 'alertDailyPct', label: 'Daily', hint: 'vs. previous close' },
  { key: 'alertWeeklyPct', label: 'Weekly', hint: 'vs. ~7 days ago' },
  { key: 'alertMonthlyPct', label: 'Monthly', hint: 'vs. ~30 days ago' },
];

const form = ref<Record<Row['key'], { enabled: boolean; pct: number | null }>>({
  alertDailyPct: { enabled: false, pct: 5 },
  alertWeeklyPct: { enabled: false, pct: 10 },
  alertMonthlyPct: { enabled: false, pct: 15 },
});

watch(
  () => props.visible,
  (visible) => {
    if (visible && props.holding) {
      for (const row of rows) {
        const stored = props.holding[row.key] as number | null | undefined;
        form.value[row.key] = {
          enabled: stored != null,
          pct: stored ?? form.value[row.key].pct,
        };
      }
    }
  },
  { immediate: true }
);

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && props.visible) emit("close");
}
onMounted(() => window.addEventListener("keydown", handleKeydown));
onUnmounted(() => window.removeEventListener("keydown", handleKeydown));

async function save() {
  if (!props.holding) return;
  const payload = {
    alertDailyPct: form.value.alertDailyPct.enabled ? clamp(form.value.alertDailyPct.pct) : null,
    alertWeeklyPct: form.value.alertWeeklyPct.enabled ? clamp(form.value.alertWeeklyPct.pct) : null,
    alertMonthlyPct: form.value.alertMonthlyPct.enabled ? clamp(form.value.alertMonthlyPct.pct) : null,
  };
  await store.editInvestmentHolding(props.holding.id, payload);
  emit("close");
}

const MIN_PCT = 0.1;

// Reject 0 or negative input — snap back up to the minimum positive threshold.
function enforceMin(key: Row['key']) {
  const v = form.value[key].pct;
  if (v == null || isNaN(v) || v < MIN_PCT) {
    form.value[key].pct = MIN_PCT;
  }
}

function clamp(pct: number | null): number | null {
  if (pct == null || isNaN(pct) || pct < MIN_PCT) return MIN_PCT;
  return Math.min(1000, pct);
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        class="absolute inset-0 bg-black/50"
        @click="emit('close')"
      />

      <div
        class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full sm:max-w-md mx-4 sm:mx-auto flex flex-col max-h-[90vh]"
        @click.stop
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div class="flex items-center gap-2">
            <i class="pi pi-bell text-primary-500" />
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              Price Alerts<span v-if="holding">: {{ holding.symbol }}</span>
            </h3>
          </div>
          <button
            class="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
            @click="emit('close')"
          >
            <i class="pi pi-times" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-3 overflow-y-auto min-h-0">
          <p class="text-sm text-gray-600 dark:text-gray-300">
            Get a desktop notification when this holding gains or loses at least the chosen percentage over a timeframe.
          </p>

          <div
            v-for="row in rows"
            :key="row.key"
            class="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800"
          >
            <div class="flex items-center justify-between">
              <div class="flex flex-col">
                <span class="text-sm font-bold text-gray-800 dark:text-gray-200">{{ row.label }}</span>
                <span class="text-xs text-gray-500 dark:text-gray-300">{{ row.hint }}</span>
              </div>
              <button
                type="button"
                role="switch"
                :aria-checked="form[row.key].enabled"
                class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                :class="form[row.key].enabled ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'"
                @click="form[row.key].enabled = !form[row.key].enabled"
              >
                <span
                  aria-hidden="true"
                  class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                  :class="form[row.key].enabled ? 'translate-x-5' : 'translate-x-0'"
                />
              </button>
            </div>
            <div
              v-if="form[row.key].enabled"
              class="mt-3 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"
            >
              <span>Notify on a move of +/-</span>
              <div class="relative">
                <input
                  v-model.number="form[row.key].pct"
                  type="number"
                  min="0.1"
                  max="1000"
                  step="0.5"
                  :style="{ width: `calc(2.75rem + ${String(form[row.key].pct ?? '0').length}ch)` }"
                  class="pl-2 pr-6 py-1 text-right border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  @change="enforceMin(row.key)"
                />
                <span class="absolute inset-y-0 right-2 flex items-center text-gray-500 dark:text-gray-200 pointer-events-none">%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-end items-center px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0 space-x-3">
          <button
            class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            @click="emit('close')"
          >
            Cancel
          </button>
          <button
            class="px-4 py-2 bg-primary-500 dark:bg-primary-900/40 text-white dark:text-primary-300 hover:bg-primary-600 dark:hover:bg-primary-900/60 rounded-lg transition-colors"
            @click="save"
          >
            Save Alerts
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
