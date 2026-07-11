<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, nextTick, ref, watch } from "vue";
import { useFinanceStore } from "@/stores/finance";
import { useSettingsStore } from "@/stores/settings";
import { useFormatter } from "@/composables/useFormatter";
import { getDateRange, getMonthName, isExpenseLike, toIsoDateString } from "@/utils";

const store = useFinanceStore();
const settingsStore = useSettingsStore();
const { formatCurrency, formatDate } = useFormatter();

const GAP = 4; // px, between cells (single source: fed to the grid styles below)
const LABEL_W = 40; // px, weekday label column (single source: fed to styles below)
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Reactive "today" that rolls over at midnight, so the YTD window, the today
// ring and the year list stay correct when the view is left open across days.
const today = ref(new Date());
let midnightTimer: number | undefined;
function armMidnightTick() {
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  midnightTimer = window.setTimeout(() => {
    today.value = new Date();
    armMidnightTick();
  }, nextMidnight.getTime() - now.getTime() + 1000);
}

// Scope-independent year list (the ledger's years, like the sibling selectors),
// not the possibly month/year-scoped store.transactions.
const availableYears = computed(() => {
  const years = new Set<number>(store.ledgerYears);
  years.add(today.value.getFullYear());
  return Array.from(years).sort((a, b) => b - a);
});

// 'YTD' = trailing 12 months (the app-wide YTD convention) or a calendar year.
const selectedRange = ref<string>("YTD");

const rangeBounds = computed(() => {
  const t = today.value;
  if (selectedRange.value === "YTD") {
    const { startDate, endDate } = getDateRange("ytd");
    return { start: startDate, end: endDate };
  }
  const year = Number(selectedRange.value);
  return {
    start: new Date(year, 0, 1),
    end:
      year === t.getFullYear()
        ? new Date(t.getFullYear(), t.getMonth(), t.getDate())
        : new Date(year, 11, 31),
  };
});

// Sum of spend per ISO day within the range, over the unscoped transaction set
// (dashboardTransactions = getAllTransactions; store.transactions can be
// month/year-scoped by the sidebar and would silently under-report here).
// Dates are compared as ISO strings to avoid timezone off-by-one from Date
// parsing; isExpenseLike keeps the totals consistent with the breakdown card
// and the type:'expense' search the day click applies.
const dailyTotals = computed<Record<string, number>>(() => {
  const startIso = toIsoDateString(rangeBounds.value.start);
  const endIso = toIsoDateString(rangeBounds.value.end);
  const totals: Record<string, number> = {};
  for (const t of store.dashboardTransactions) {
    if (!isExpenseLike(t)) continue;
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

// GitHub-style grid: columns are weeks (Sun→Sat rows). `lead` is the row
// offset of the range's first day (rendered as one spacer spanning that many
// rows, so the v-for stays a flat list of real days for v-memo).
const calendar = computed(() => {
  const { start, end } = rangeBounds.value;
  const lead = start.getDay();

  const cells: DayCell[] = [];
  const markers: { col: number; label: string }[] = [];
  const cursor = new Date(start);
  let slot = lead;
  while (cursor <= end) {
    if (cursor.getDate() === 1) {
      markers.push({
        col: Math.floor(slot / 7),
        label: getMonthName(cursor.getMonth() + 1).slice(0, 3),
      });
    }
    const iso = toIsoDateString(cursor);
    const total = dailyTotals.value[iso] || 0;
    cells.push({ iso, total, level: intensityLevel(total) });
    slot++;
    cursor.setDate(cursor.getDate() + 1);
  }

  return { cells, markers, lead, cols: Math.ceil(slot / 7) };
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

const todayIso = computed(() => toIsoDateString(today.value));

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
// The month-label and legend row heights are measured from the DOM (incl.
// margins) so the math can't drift from the Tailwind classes.
const MAX_ASPECT = 1.6;
const wrapEl = ref<HTMLElement | null>(null);
const monthRowEl = ref<HTMLElement | null>(null);
const legendEl = ref<HTMLElement | null>(null);
const cellW = ref(14);
const cellH = ref(14);
const pitchX = computed(() => cellW.value + GAP);

function outerHeight(el: HTMLElement | null): number {
  if (!el) return 0;
  const cs = window.getComputedStyle(el);
  return el.offsetHeight + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
}

function recomputeCell() {
  const el = wrapEl.value;
  const cols = calendar.value.cols;
  if (!el || !cols) return;
  const availW = el.clientWidth - LABEL_W - GAP;
  const availH =
    el.clientHeight - outerHeight(monthRowEl.value) - outerHeight(legendEl.value);
  const sizeW = Math.floor((availW - (cols - 1) * GAP) / cols);
  const sizeH = Math.floor((availH - 6 * GAP) / 7);
  cellW.value = Math.max(11, Math.min(sizeW, 40));
  cellH.value = Math.max(
    11,
    Math.min(sizeH, 40, Math.round(cellW.value * MAX_ASPECT))
  );
}

// Floating tooltip anchored to the hovered cell's rect (not the mouse), so it
// sits centered above the cell no matter where the pointer entered.
const hovered = ref<DayCell | null>(null);
const tipPos = ref({ x: 0, y: 0 });

let resizeObserver: ResizeObserver | null = null;
onMounted(() => {
  resizeObserver = new ResizeObserver(() => recomputeCell());
  if (wrapEl.value) resizeObserver.observe(wrapEl.value);
  recomputeCell();
  armMidnightTick();
});
onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  if (midnightTimer) window.clearTimeout(midnightTimer);
});
// A grid rebuild can replace a hovered cell in place (no mouseleave fires), so
// drop any tooltip alongside the resize pass.
watch(calendar, () => {
  hovered.value = null;
  nextTick(recomputeCell);
});

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
  marginRight: `${GAP}px`,
}));

function onEnter(cell: DayCell, e: MouseEvent) {
  hovered.value = cell;
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  tipPos.value = { x: rect.left + rect.width / 2, y: rect.top };
}

function onDayClick(cell: DayCell) {
  if (cell.total <= 0) return; // an empty day has nothing to drill into
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
          ref="monthRowEl"
          class="relative h-5 mb-1"
          :style="{ marginLeft: `${LABEL_W + GAP}px` }"
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
            class="text-xs text-gray-500 dark:text-gray-400"
            :style="weekdayGridStyle"
          >
            <span
              v-for="wd in WEEKDAYS"
              :key="wd"
              class="flex items-center justify-end pr-1.5 leading-none"
            >{{ wd }}</span>
          </div>

          <!-- Day grid: leading spacer pushes day 1 onto its weekday row -->
          <div :style="dayGridStyle">
            <div
              v-if="calendar.lead"
              :style="{ gridRow: `span ${calendar.lead}` }"
            />
            <button
              v-for="cell in calendar.cells"
              :key="cell.iso"
              v-memo="[cell.total, cell.level, cell.iso === todayIso]"
              class="w-full h-full rounded-[3px] transition-transform hover:ring-2 hover:ring-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              :class="[
                LEVEL_BG[cell.level],
                cell.iso === todayIso ? 'ring-1 ring-primary-500' : '',
                cell.total > 0 ? 'cursor-pointer' : 'cursor-default',
              ]"
              @mouseenter="onEnter(cell, $event)"
              @mouseleave="hovered = null"
              @click="onDayClick(cell)"
            />
          </div>
        </div>

        <!-- Legend -->
        <div
          ref="legendEl"
          class="flex items-center justify-end gap-1.5 mt-3 text-xs text-gray-400"
        >
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
        :style="{ left: `${tipPos.x}px`, top: `${tipPos.y - 6}px` }"
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
