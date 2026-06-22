<script setup lang="ts">
import { computed } from "vue";
import Tooltip from "primevue/tooltip";
import { useFinanceStore } from "@/stores/finance";
import { useSettingsStore } from "@/stores/settings";
import { useFormatter } from "@/composables/useFormatter";
import { ACCOUNT_CLASSIFICATION_META } from "@/utils";
import type { AccountClassification } from "@/types";

const vTooltip = Tooltip;

const emit = defineEmits<{
  (e: "view-accounts", classification?: string): void;
}>();

const store = useFinanceStore();
const settingsStore = useSettingsStore();
const { formatCurrency } = useFormatter();

const CLASS_META = (Object.keys(ACCOUNT_CLASSIFICATION_META) as AccountClassification[]).map((key) => ({
  key,
  label: ACCOUNT_CLASSIFICATION_META[key].label,
  color: ACCOUNT_CLASSIFICATION_META[key].color,
}));

const stats = computed(() => {
  const totals: Record<AccountClassification, number> = { liquid: 0, investment: 0, asset: 0, liability: 0 };
  const counts: Record<AccountClassification, number> = { liquid: 0, investment: 0, asset: 0, liability: 0 };
  for (const a of store.accounts) {
    const c = store.accountTypes.find((at) => at.id === a.accountTypeId)?.classification ?? "liquid";
    totals[c] += a.balance || 0;
    counts[c] += 1;
  }
  return { totals, counts };
});

// Debt magnitude: liability accounts are stored negative; a positive (overpaid)
// balance is a credit, not a debt, so it contributes 0 here.
const liabilityTotal = computed(() => Math.max(0, -stats.value.totals.liability));
const totalAssets = computed(
  () =>
    Math.max(0, stats.value.totals.liquid) +
    Math.max(0, stats.value.totals.investment) +
    Math.max(0, stats.value.totals.asset)
);
// Raw sum of all account balances — matches the Net Worth KPI card exactly.
const netWorth = computed(
  () =>
    stats.value.totals.liquid +
    stats.value.totals.investment +
    stats.value.totals.asset +
    stats.value.totals.liability
);

// Both bars share a scale so the liabilities bar reads as leverage against assets.
const scaleMax = computed(() => Math.max(totalAssets.value, liabilityTotal.value) || 1);
const widthPct = (v: number) => `${(Math.max(0, v) / scaleMax.value) * 100}%`;

// Bar segments: positive asset classes only (a negative balance can't have width).
const assetSegments = computed(() =>
  CLASS_META.filter((c) => c.key !== "liability" && stats.value.totals[c.key] > 0).map((c) => ({
    key: c.key,
    label: c.label,
    color: c.color,
    value: stats.value.totals[c.key],
  }))
);

// Legend identifies every classification that has an account.
const legend = computed(() =>
  CLASS_META.filter((c) => stats.value.counts[c.key] > 0)
);

const hasData = computed(() => store.accounts.length > 0);

function tip(label: string, value: number): string {
  return settingsStore.privacyMode ? label : `${label}: ${formatCurrency(value)}`;
}
</script>

<template>
  <div class="card p-5 flex flex-col">
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-base font-semibold text-gray-900 dark:text-white">
        Net Worth Composition
      </h2>
      <span
        class="text-base font-bold text-gray-900 dark:text-white"
        :class="{ 'privacy-blur': settingsStore.privacyMode }"
      >
        {{ formatCurrency(netWorth) }}
      </span>
    </div>

    <div
      v-if="!hasData"
      class="flex-1 flex flex-col items-center justify-center py-4 text-gray-500 dark:text-gray-400"
    >
      <i class="pi pi-chart-bar text-3xl text-gray-300 dark:text-gray-600 mb-2" />
      <p class="text-sm">
        No accounts yet
      </p>
    </div>

    <template v-else>
      <!-- Assets -->
      <div class="mb-2">
        <div class="flex items-center justify-between text-sm mb-1.5">
          <span class="font-medium text-gray-600 dark:text-gray-300">Assets</span>
          <span
            class="text-gray-500 dark:text-gray-400"
            :class="{ 'privacy-blur': settingsStore.privacyMode }"
          >{{ formatCurrency(totalAssets) }}</span>
        </div>
        <div class="flex h-3 w-full rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
          <div
            v-for="seg in assetSegments"
            :key="seg.key"
            v-tooltip.top="tip(seg.label, seg.value)"
            class="h-full cursor-pointer"
            :style="{ width: widthPct(seg.value), backgroundColor: seg.color }"
            @click.stop="emit('view-accounts', seg.key)"
          />
        </div>
      </div>

      <!-- Liabilities -->
      <div class="mb-3">
        <div class="flex items-center justify-between text-sm mb-1.5">
          <span class="font-medium text-gray-600 dark:text-gray-300">Liabilities</span>
          <span
            class="text-gray-500 dark:text-gray-400"
            :class="{ 'privacy-blur': settingsStore.privacyMode }"
          >{{ formatCurrency(liabilityTotal) }}</span>
        </div>
        <div class="h-3 w-full rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
          <div
            v-tooltip.top="tip('Liabilities', liabilityTotal)"
            class="h-full rounded-full cursor-pointer"
            :style="{ width: widthPct(liabilityTotal), backgroundColor: '#ef4444' }"
            @click.stop="emit('view-accounts', 'liability')"
          />
        </div>
      </div>

      <!-- Legend -->
      <div class="flex flex-wrap gap-x-4 gap-y-1 mt-auto">
        <button
          v-for="item in legend"
          :key="item.key"
          class="inline-flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity"
          @click.stop="emit('view-accounts', item.key)"
        >
          <span
            class="w-2.5 h-2.5 rounded-full shrink-0"
            :style="{ backgroundColor: item.color }"
          />
          <span class="text-gray-500 dark:text-gray-400">{{ item.label }}</span>
        </button>
      </div>
    </template>
  </div>
</template>
