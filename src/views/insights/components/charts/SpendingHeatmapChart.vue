<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, nextTick, ref, watch } from "vue";
import { useFinanceStore } from "@/stores/finance";
import { useSettingsStore } from "@/stores/settings";
import { useFormatter } from "@/composables/useFormatter";
import { toIsoDateString } from "@/utils";

const store = useFinanceStore();
const settingsStore = useSettingsStore();
const { formatCurrency, formatDate } = useFormatter();

const GAP = 4; // px, between cells
const LABEL_W = 40; // px, weekday label column
const MONTH_ROW_H = 24; // px, month-label row (h-5 + mb-1)
const LEGEND_H = 28; // px, legend row incl. its top margin
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const now = new Date();

// Years present in the loaded transactions, plus the current year, newest first.
const availableYears = computed(() => {
  const years = new Set<number>([now.getFullYear()]);
  for (const t of store.transactions) {
    const y = Number(t.date.slice(0, 4));
    if (y) years.add(y);
  }
  return Array.from(years).sort((a, b) => b - a);
});

// 'YTD' = trailing 12 months (GitHub's own window) or a calendar year.
const selectedRange = ref<string>("YTD");

const rangeBounds = computed(() => {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (selectedRange.value === "YTD") {
    const start = new Date(today);
    start.setFullYear(start.getFullYear() - 1);
    start.setDate(start.getDate() + 1);
    return { start, end: today };
  }
  const year = Number(selectedRange.value);
  return {
    start: new Date(year, 0, 1),
    end: year === now.getFullYear() ? today : new Date(year, 11, 31),
  };
});

// Sum of expenses per ISO day within the range, counting expense-transfers
// like getExpenseBreakdownForRange does (and like the type:'expense' search
// filter the day click applies). Dates are compared as ISO strings to avoid
// timezone off-by-one from Date parsing.
const dailyTotals = computed<Record<string, number>>(() => {
  const startIso = toIsoDateString(rangeBounds.value.start);
  const endIso = toIsoDateString(rangeBounds.value.end);
  const totals: Record<string, number> = {};
  for (const t of store.transactions) {
    if (t.type !== "expense" && !(t.type === "transfer" && t.isExpenseTransfer)) continue;
    if (t.date < startIso || t.date > endIso) continue;
    totals[t.date] = (totals[t.date] || 0) + t.amount;
  }
  return totals;
});

const maxTotal = computed(() => {
  const values = Object.values(dailyTotals.value);
  return values.length ? Math.max(...values) : 0;
});

const rangeTotal = computed(() =>
  Object.values(dailyTotals.value).reduce((sum, v) => sum + v, 0)
);

interface DayCell {
  iso: string;
  total: number;
  level: number;
}

// A 0-based level from 0 (no spend) to 4 (highest), relative to the range's peak day.
function intensityLevel(total: number): number {
  if (total <= 0 || maxTotal.value <= 0) return 0;
  const ratio = total / maxTotal.value;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

// GitHub-style grid: columns are weeks (Sun→Sat rows). Leading nulls pad the
// first week so the range's first day lands on its weekday row.
const calendar = computed(() => {
  const { start, end } = rangeBounds.value;

  const cells: (DayCell | null)[] = [];
  for (let i = 0; i < start.getDay(); i++) cells.push(null);

  const markers: { col: number; label: string }[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    if (cursor.getDate() === 1) {
      markers.push({
        col: Math.floor(cells.length / 7),
        label: SHORT_MONTHS[cursor.getMonth()],
      });
    }
    const iso = toIsoDateString(cursor);
    const total = dailyTotals.value[iso] || 0;
    cells.push({ iso, total, level: intensityLevel(total) });
    cursor.setDate(cursor.getDate() + 1);
  }

  return { cells, markers, cols: Math.ceil(cells.length / 7) };
});

// Each month's label centered over the weeks it spans (vs. GitHub's
// left-anchored labels, which visually detach from their month).
const monthSpans = computed(() => {
  const { markers, cols } = calendar.value;
  return markers.map((m, i) => {
    const nextCol = i + 1 < markers.length ? markers[i + 1].col : cols;
    return { label: m.label, col: m.col, span: Math.max(nextCol - m.col, 1) };
  });
});

const todayIso = toIsoDateString(now);

// Translucent overlays on the card background so intensity reads in light + dark.
const LEVEL_BG = [
  "bg-gray-100 dark:bg-gray-700/50",
  "bg-expense/25",
  "bg-expense/45",
  "bg-expense/70",
  "bg-expense/95",
] as const;

// Cells scale to fill the card: width and height are computed independently so
// a full year (53 week-columns) still fills the vertical space — cells go
// rectangular up to a capped aspect ratio instead of shrinking to tiny squares.
const MAX_ASPECT = 1.6;
const wrapEl = ref<HTMLElement | null>(null);
const cellW = ref(14);
const cellH = ref(14);
const pitchX = computed(() => cellW.value + GAP);

function recomputeCell() {
  const el = wrapEl.value;
  const cols = calendar.value.cols;
  if (!el || !cols) return;
  const availW = el.clientWidth - LABEL_W - 4; // minus weekday labels + their margin
  const availH = el.clientHeight - MONTH_ROW_H - LEGEND_H;
  const sizeW = Math.floor((availW - (cols - 1) * GAP) / cols);
  const sizeH = Math.floor((availH - 6 * GAP) / 7);
  cellW.value = Math.max(11, Math.min(sizeW, 40));
  cellH.value = Math.max(
    11,
    Math.min(sizeH, 40, Math.round(cellW.value * MAX_ASPECT))
  );
}

let resizeObserver: ResizeObserver | null = null;
onMounted(() => {
  resizeObserver = new ResizeObserver(() => recomputeCell());
  if (wrapEl.value) resizeObserver.observe(wrapEl.value);
  recomputeCell();
});
onBeforeUnmount(() => resizeObserver?.disconnect());
watch(() => calendar.value.cols, () => nextTick(recomputeCell));

const dayGridStyle = computed(() => ({
  display: "grid",
  gridTemplateRows: `repeat(7, ${cellH.value}px)`,
  gridAutoFlow: "column" as const,
  gridAutoColumns: `${cellW.value}px`,
  gap: `${GAP}px`,
}));

const weekdayGridStyle = computed(() => ({
  display: "grid",
  gridTemplateRows: `repeat(7, ${cellH.value}px)`,
  gap: `${GAP}px`,
  width: `${LABEL_W}px`,
}));

// Floating tooltip driven by a single hover state (cheaper than one node per cell).
const hovered = ref<DayCell | null>(null);
const tipPos = ref({ x: 0, y: 0 });

function onEnter(cell: DayCell, e: MouseEvent) {
  hovered.value = cell;
  tipPos.value = { x: e.clientX, y: e.clientY };
}

function onDayClick(cell: DayCell) {
  const filter = {
    fromDate: cell.iso,
    toDate: cell.iso,
    type: "expense" as const,
  };
  store.setTransactionFilter(filter);
  store.searchTransactions(filter);
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="relative flex items-center justify-end mb-4 min-h-[32px]">
      <span
        v-if="rangeTotal > 0"
        class="hidden sm:inline absolute left-0 text-sm text-gray-400"
      >
        Total
        <span
          class="font-semibold text-gray-600 dark:text-gray-300"
          :class="{ 'privacy-blur': settingsStore.privacyMode }"
        >{{ formatCurrency(rangeTotal) }}</span>
      </span>

      <h3 class="xl:absolute xl:left-1/2 xl:-translate-x-1/2 font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap text-sm lg:text-base flex-1 xl:flex-none text-center">
        Spending Calendar
      </h3>

      <div class="z-10">
        <select
          v-model="selectedRange"
          class="text-[10px] lg:text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none cursor-pointer"
        >
          <option value="YTD">
            YTD
          </option>
          <option
            v-for="year in availableYears"
            :key="year"
            :value="year.toString()"
          >
            {{ year }}
          </option>
        </select>
      </div>
    </div>

    <div
      ref="wrapEl"
      class="flex-1 flex flex-col justify-center min-h-0"
    >
      <!-- Graph, centered in the card -->
      <div class="mx-auto w-fit max-w-full">
        <!-- Month labels: each centered over the weeks its month spans -->
        <div
          class="relative h-5 mb-1"
          :style="{ marginLeft: `${LABEL_W + 4}px` }"
        >
          <span
            v-for="(m, i) in monthSpans"
            :key="i"
            class="absolute top-0 text-[13px] font-medium text-gray-500 dark:text-gray-400 text-center truncate"
            :style="{ left: `${m.col * pitchX}px`, width: `${m.span * pitchX - GAP}px` }"
          >
            {{ m.label }}
          </span>
        </div>

        <div class="flex">
          <!-- Weekday labels -->
          <div
            class="mr-1 text-xs text-gray-500 dark:text-gray-400"
            :style="weekdayGridStyle"
          >
            <span
              v-for="wd in WEEKDAYS"
              :key="wd"
              class="flex items-center justify-end pr-1.5 leading-none"
            >{{ wd }}</span>
          </div>

          <!-- Day grid -->
          <div :style="dayGridStyle">
            <template
              v-for="(cell, idx) in calendar.cells"
              :key="idx"
            >
              <div v-if="!cell" />
              <button
                v-else
                class="w-full h-full rounded-[3px] transition-transform hover:ring-2 hover:ring-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                :class="[LEVEL_BG[cell.level], cell.iso === todayIso ? 'ring-1 ring-primary-500' : '']"
                @mouseenter="onEnter(cell, $event)"
                @mouseleave="hovered = null"
                @click="onDayClick(cell)"
              />
            </template>
          </div>
        </div>

        <!-- Legend -->
        <div class="flex items-center justify-end gap-1.5 mt-3 text-xs text-gray-400">
          <span>Less</span>
          <div
            v-for="lvl in [0, 1, 2, 3, 4]"
            :key="lvl"
            class="w-3.5 h-3.5 rounded-[3px]"
            :class="LEVEL_BG[lvl]"
          />
          <span>More</span>
        </div>
      </div>
    </div>

    <!-- Floating hover tooltip -->
    <Teleport to="body">
      <div
        v-if="hovered"
        class="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-gray-900 dark:bg-gray-700 px-2.5 py-1.5 text-xs text-white shadow-lg"
        :style="{ left: `${tipPos.x}px`, top: `${tipPos.y - 8}px` }"
      >
        <div class="font-semibold">
          {{ formatDate(hovered.iso) }}
        </div>
        <div class="text-gray-300">
          <span :class="{ 'privacy-blur': settingsStore.privacyMode }">{{ formatCurrency(hovered.total) }}</span>
          spent
        </div>
      </div>
    </Teleport>
  </div>
</template>
