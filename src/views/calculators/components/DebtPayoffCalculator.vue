<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSettingsStore } from '@/stores/settings';
import { useFormatter } from '@/composables/useFormatter';
import { simulateDebtPayoff, type SimDebt } from '@/utils';
import AppChart from '@/components/AppChart.vue';
import ErrorModal from '@/components/ErrorModal.vue';

const settingsStore = useSettingsStore();
const { formatCurrency } = useFormatter();
const errorModal = ref<InstanceType<typeof ErrorModal> | null>(null);

interface DebtEntry {
  id: number;
  name: string;
  balance: number | null;
  rate: number | null;
  minPayment: number | null;
}

let nextId = 0;
const makeDebt = (): DebtEntry => ({ id: nextId++, name: '', balance: null, rate: null, minPayment: null });

// Inputs — all null on startup; state is preserved across navigation via v-show in App.vue
const debts = ref<DebtEntry[]>([makeDebt(), makeDebt()]);
const extraPayment = ref<number | null>(null);

const addDebt = () => debts.value.push(makeDebt());
const removeDebt = (id: number) => {
  if (debts.value.length <= 1) return;
  debts.value = debts.value.filter(d => d.id !== id);
};

interface PayoffResult {
  avalancheMonths: number;
  snowballMonths: number;
  avalancheTotalInterest: number;
  snowballTotalInterest: number;
  avalancheCurve: number[];
  snowballCurve: number[];
  totalDebt: number;
  capped: boolean;
}

const payoffResult = ref<PayoffResult | null>(null);

const calculate = () => {
  const validDebts: SimDebt[] = debts.value
    .filter(d => (d.balance ?? 0) > 0.005)
    .map(d => ({
      balance: d.balance!,
      rate: d.rate ?? 0,
      minPayment: d.minPayment ?? 0,
    }));

  const extra = Math.max(0, extraPayment.value ?? 0);
  const totalDebt = validDebts.reduce((s, d) => s + d.balance, 0);

  const avalanche = simulateDebtPayoff(validDebts, extra, 'avalanche');
  const snowball = simulateDebtPayoff(validDebts, extra, 'snowball');

  // Pad shorter curve so both datasets are the same length for the chart
  const maxLen = Math.max(avalanche.curve.length, snowball.curve.length);
  while (avalanche.curve.length < maxLen) avalanche.curve.push(0);
  while (snowball.curve.length < maxLen) snowball.curve.push(0);

  payoffResult.value = {
    avalancheMonths: avalanche.months,
    snowballMonths: snowball.months,
    avalancheTotalInterest: avalanche.totalInterest,
    snowballTotalInterest: snowball.totalInterest,
    avalancheCurve: avalanche.curve,
    snowballCurve: snowball.curve,
    totalDebt,
    capped: avalanche.capped || snowball.capped,
  };
};

// Snapshots of inputs at the time Calculate was last clicked — prevents
// strategyBreakdown from reacting to live input changes between calculations.
interface DebtSnapshot { id: number; name: string; balance: number; rate: number; }
const snapshotDebts = ref<DebtSnapshot[]>([]);
const snapshotExtra = ref(0);

const hasCalculated = ref(false);
const chartKey = ref(0);
const isExpanded = ref(true);

const showError = (message: string) => {
  errorModal.value?.openConfirmation({ title: 'Invalid Input', message });
};

const onCalculate = () => {
  const filledDebts = debts.value.filter(d => (d.balance ?? 0) > 0);
  if (filledDebts.length === 0) {
    showError('Add at least one debt with a balance greater than zero.');
    return;
  }
  for (const d of filledDebts) {
    if ((d.rate ?? 0) < 0) { showError('Interest rates cannot be negative.'); return; }
    if ((d.minPayment ?? 0) <= 0) {
      showError(`"${d.name || 'Unnamed Debt'}" needs a minimum monthly payment greater than zero.`);
      return;
    }
  }
  if ((extraPayment.value ?? 0) < 0) {
    showError('Extra monthly payment cannot be negative.');
    return;
  }

  snapshotDebts.value = debts.value
    .filter(d => (d.balance ?? 0) > 0)
    .map(d => ({ id: d.id, name: d.name, balance: d.balance!, rate: d.rate ?? 0 }));
  snapshotExtra.value = extraPayment.value ?? 0;
  calculate();
  hasCalculated.value = true;
  chartKey.value++;
};

const formatMonths = (m: number): string => {
  if (m <= 0) return '0 mo';
  const y = Math.floor(m / 12);
  const mo = m % 12;
  if (y === 0) return `${mo} mo`;
  if (mo === 0) return `${y} yr`;
  return `${y} yr, ${mo} mo`;
};

const strategyBreakdown = computed(() => {
  const data = payoffResult.value;
  const filled = snapshotDebts.value;
  if (!data || filled.length === 0) return null;

  const extra = snapshotExtra.value;
  const interestDiff = data.snowballTotalInterest - data.avalancheTotalInterest;
  const timeDiff = data.snowballMonths - data.avalancheMonths;

  if (extra === 0) {
    return {
      kind: 'equal' as const,
      message: 'With no extra monthly payment, both strategies just pay each debt\'s minimum — there\'s nothing extra to direct strategically. Add an extra monthly payment to see them diverge.'
    };
  }

  const avalancheFirst = [...filled].sort((a, b) => b.rate - a.rate)[0];
  const snowballFirst = [...filled].sort((a, b) => a.balance - b.balance)[0];

  if (avalancheFirst.id === snowballFirst.id) {
    return {
      kind: 'equal' as const,
      message: `Both strategies target "${avalancheFirst.name || 'the same debt'}" first — it has both the highest rate (${avalancheFirst.rate}%) and the smallest balance (${formatCurrency(avalancheFirst.balance)}). The payoff order is identical.`
    };
  }

  const aName = avalancheFirst.name || 'highest-rate debt';
  const sName = snowballFirst.name || 'smallest debt';

  let message = `Avalanche targets "${aName}" first (${avalancheFirst.rate}% rate), minimizing total interest. `;
  message += `Snowball targets "${sName}" first (${formatCurrency(snowballFirst.balance)} balance) for a quicker early win`;
  if (interestDiff > 0.01) {
    message += `, but costs ${formatCurrency(interestDiff)} more in interest`;
  }
  message += '.';
  if (timeDiff !== 0) {
    const sign = timeDiff > 0 ? 'Avalanche also finishes' : 'Snowball finishes';
    message += ` ${sign} ${formatMonths(Math.abs(timeDiff))} sooner.`;
  }

  return { kind: 'avalanche' as const, interestSaved: interestDiff, message };
});

const displayScale = ref<'months' | 'years'>('months');

const scaleOptions = [
  { label: 'Months', value: 'months' },
  { label: 'Years', value: 'years' },
];

// Subsample monthly curves to yearly when displayScale === 'years' (live, no recalc needed)
const scaledCurves = computed(() => {
  const data = payoffResult.value;
  if (!data) return null;
  if (displayScale.value === 'months') {
    return { avalanche: data.avalancheCurve, snowball: data.snowballCurve };
  }
  return {
    avalanche: data.avalancheCurve.filter((_, i) => i % 12 === 0),
    snowball: data.snowballCurve.filter((_, i) => i % 12 === 0),
  };
});

// Milestone dots every 5 years in years mode, every 12 months in months mode
const milestonePointRadii = computed(() => {
  const curves = scaledCurves.value;
  if (!curves) return [];
  const interval = displayScale.value === 'years' ? 5 : 12;
  return curves.avalanche.map((_, i) => (i > 0 && i % interval === 0 ? 4 : 0));
});

const chartPlugins = [{
  id: 'crosshair',
  afterDraw(chart: any) {
    const active = chart.tooltip._active as any[];
    if (!active?.length) return;
    const { ctx } = chart;
    const x = active[0].element.x;
    const { top, bottom } = chart.scales.y;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.lineWidth = 1;
    ctx.strokeStyle = settingsStore.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.restore();
  }
}];

const chartData = computed(() => {
  const curves = scaledCurves.value;
  if (!curves) return { labels: [], datasets: [] };

  const len = curves.avalanche.length;
  const labels = Array.from({ length: len }, (_, i) => `${i}`);
  const radii = milestonePointRadii.value;

  return {
    labels,
    datasets: [
      {
        type: 'line' as const,
        label: 'Avalanche',
        data: curves.avalanche,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.1)',
        borderWidth: 2,
        tension: 0.3,
        fill: false,
        pointRadius: radii,
        pointHitRadius: 10,
        pointHoverRadius: 6,
        pointBackgroundColor: '#3b82f6',
        pointBorderWidth: 0,
      },
      {
        type: 'line' as const,
        label: 'Snowball',
        data: curves.snowball,
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245,158,11,0.1)',
        borderWidth: 2,
        tension: 0.3,
        fill: false,
        pointRadius: radii,
        pointHitRadius: 10,
        pointHoverRadius: 6,
        pointBackgroundColor: '#f59e0b',
        pointBorderWidth: 0,
      },
    ],
  };
});

const chartOptions = computed(() => {
  return {
    animations: {
      y: {
        duration: 800,
        easing: 'easeOutQuart' as const,
        from: (ctx: any) => ctx.chart.scales?.y?.getPixelForValue?.(0) ?? 0,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        title: { display: true, text: displayScale.value === 'years' ? 'Years' : 'Months' },
      },
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Total Remaining Balance' },
        ticks: {
          callback: (value: any) => formatCurrency(value),
        },
      },
    },
    plugins: {
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          title: (items: any[]) => {
            if (!items.length) return '';
            const unit = displayScale.value === 'years' ? 'Year' : 'Month';
            return `${unit} ${items[0].label}`;
          },
          label: (context: any) => {
            const label = context.dataset.label || '';
            return `${label}: ${formatCurrency(context.parsed.y ?? 0)}`;
          },
        },
      },
      legend: { display: false },
    },
    interaction: { mode: 'nearest' as const, axis: 'x' as const, intersect: false },
    maintainAspectRatio: false,
    responsive: true,
  };
});
</script>

<template>
  <section class="flex flex-col">
    <ErrorModal ref="errorModal" />

    <!-- Header -->
    <div
      class="flex items-center gap-4 cursor-pointer select-none group"
      :class="isExpanded ? 'mb-6' : 'mb-0'"
      @click="isExpanded = !isExpanded"
    >
      <div class="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-red-600 dark:text-red-400">
        <i class="pi pi-credit-card text-xl" />
      </div>
      <div class="flex-1">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">
          Debt Payoff Planner
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Compare avalanche vs snowball strategies to eliminate your debts
        </p>
      </div>
      <i
        class="pi transition-transform duration-200 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 mr-1"
        :class="isExpanded ? 'pi-chevron-down' : 'pi-chevron-right'"
      />
    </div>

    <!-- Content: side-by-side, items-start prevents input card from stretching -->
    <div
      v-show="isExpanded"
      class="grid grid-cols-1 lg:grid-cols-4 lg:items-start gap-4"
    >
      <!-- Left column: input + post-calculate explanation -->
      <div class="lg:col-span-2 flex flex-col gap-4">
        <!-- Input Panel -->
        <div class="bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex flex-col gap-4">
          <!-- Debt Table -->
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th class="text-left pb-2 pr-2">
                    Debt Name
                  </th>
                  <th class="text-left pb-2 pr-2">
                    Balance
                  </th>
                  <th class="text-left pb-2 pr-2">
                    Rate %
                  </th>
                  <th class="text-left pb-2 pr-2">
                    Min. Payment
                  </th>
                  <th class="pb-2 w-6" />
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-700/60">
                <tr
                  v-for="debt in debts"
                  :key="debt.id"
                >
                  <td class="py-1.5 pr-2">
                    <input
                      v-model="debt.name"
                      type="text"
                      placeholder="e.g. Credit Card"
                      class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    />
                  </td>
                  <td class="py-1.5 pr-2">
                    <div class="relative flex items-center">
                      <span class="absolute left-2 text-[10px] text-gray-400 pointer-events-none">$</span>
                      <input
                        v-model.number="debt.balance"
                        type="number"
                        min="0"
                        placeholder="0"
                        class="w-full pl-5 pr-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </td>
                  <td class="py-1.5 pr-2">
                    <div class="relative flex items-center">
                      <input
                        v-model.number="debt.rate"
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        placeholder="0.0"
                        class="w-full pl-2 pr-5 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      />
                      <span class="absolute right-2 text-[10px] text-gray-400 pointer-events-none">%</span>
                    </div>
                  </td>
                  <td class="py-1.5 pr-2">
                    <div class="relative flex items-center">
                      <span class="absolute left-2 text-[10px] text-gray-400 pointer-events-none">$</span>
                      <input
                        v-model.number="debt.minPayment"
                        type="number"
                        min="0"
                        placeholder="0"
                        class="w-full pl-5 pr-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </td>
                  <td class="py-1.5 text-center">
                    <button
                      :disabled="debts.length <= 1"
                      class="text-gray-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      @click="removeDebt(debt.id)"
                    >
                      <i class="pi pi-times text-xs" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            <button
              class="mt-2 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium flex items-center gap-1 transition-colors"
              @click="addDebt"
            >
              <i class="pi pi-plus text-[10px]" />
              Add Debt
            </button>
          </div>

          <!-- Extra Payment -->
          <div>
            <div class="flex items-center gap-2">
              <label class="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">Extra Monthly Payment:</label>
              <div class="relative flex items-center">
                <span class="absolute left-2 text-[10px] text-gray-400 pointer-events-none">$</span>
                <input
                  v-model.number="extraPayment"
                  type="number"
                  min="0"
                  step="50"
                  placeholder="0"
                  class="pl-5 pr-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                  :style="{ width: Math.max(4, String(extraPayment ?? '').length) + 5 + 'ch' }"
                />
              </div>
            </div>
            <p class="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
              Amount above all minimums — both strategies share the same total budget
            </p>
          </div>

          <div class="flex justify-center">
            <button
              class="px-4 py-2 bg-primary-500 dark:bg-primary-900/40 text-white dark:text-primary-300 hover:bg-primary-600 dark:hover:bg-primary-900/60 rounded-lg transition-colors font-medium text-sm"
              @click="onCalculate"
            >
              Calculate
            </button>
          </div>
        </div>

        <!-- Strategy explanation (post-calculate) -->
        <div
          v-if="hasCalculated && strategyBreakdown"
          class="bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-start gap-3"
        >
          <i
            class="pi mt-0.5 shrink-0 text-base"
            :class="strategyBreakdown.kind === 'equal'
              ? 'pi-info-circle text-gray-400 dark:text-gray-500'
              : 'pi-lightbulb text-blue-500 dark:text-blue-400'"
          />
          <div>
            <p class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              {{ strategyBreakdown.kind === 'equal' ? 'Why both strategies are equal' : 'Why Avalanche is recommended' }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              {{ strategyBreakdown.message }}
            </p>
          </div>
        </div>
      </div><!-- end left column -->

      <!-- Placeholder before first calculation -->
      <div
        v-if="!hasCalculated"
        class="lg:col-span-2 flex items-center justify-center rounded-xl border border-dashed border-gray-200 dark:border-gray-700"
      >
        <div class="text-center py-12">
          <i class="pi pi-credit-card text-4xl text-gray-300 dark:text-gray-600 mb-3 block" />
          <p class="text-sm text-gray-400 dark:text-gray-500">
            Enter your debts and click Calculate to compare payoff strategies
          </p>
        </div>
      </div>

      <!-- Results -->
      <div
        v-else-if="payoffResult"
        class="lg:col-span-2 flex flex-col gap-4"
      >
        <!-- Metrics -->
        <div class="grid grid-cols-2 gap-3">
          <!-- Avalanche card -->
          <div class="card p-4 border-l-2 border-blue-500">
            <div class="flex items-center gap-1.5 mb-2">
              <div class="w-2.5 h-1.5 rounded-sm bg-blue-500 shrink-0" />
              <p class="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                Avalanche
              </p>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
              Total Interest
            </p>
            <p
              class="text-base font-bold text-red-600 dark:text-red-500 truncate"
            >
              {{ formatCurrency(payoffResult.avalancheTotalInterest) }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-2 mb-0.5">
              Payoff Time
            </p>
            <p class="text-base font-bold text-gray-900 dark:text-white">
              {{ formatMonths(payoffResult.avalancheMonths) }}
            </p>
          </div>

          <!-- Snowball card -->
          <div class="card p-4 border-l-2 border-amber-500">
            <div class="flex items-center gap-1.5 mb-2">
              <div class="w-2.5 h-1.5 rounded-sm bg-amber-500 shrink-0" />
              <p class="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                Snowball
              </p>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
              Total Interest
            </p>
            <p
              class="text-base font-bold text-red-600 dark:text-red-500 truncate"
            >
              {{ formatCurrency(payoffResult.snowballTotalInterest) }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-2 mb-0.5">
              Payoff Time
            </p>
            <p class="text-base font-bold text-gray-900 dark:text-white">
              {{ formatMonths(payoffResult.snowballMonths) }}
            </p>
          </div>

          <!-- Interest comparison -->
          <div class="card p-4 col-span-2">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Interest Saved
            </p>
            <template v-if="payoffResult.avalancheTotalInterest !== payoffResult.snowballTotalInterest">
              <p
                class="text-lg font-bold text-emerald-600 dark:text-emerald-500 truncate"
              >
                {{ formatCurrency(Math.abs(payoffResult.snowballTotalInterest - payoffResult.avalancheTotalInterest)) }}
                <span class="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">
                  saved with {{ payoffResult.avalancheTotalInterest < payoffResult.snowballTotalInterest ? 'Avalanche' : 'Snowball' }}
                </span>
              </p>
            </template>
            <div v-else>
              <p class="text-base font-bold text-gray-400 dark:text-gray-600">
                Both strategies are equal
              </p>
              <p
                v-if="(extraPayment ?? 0) === 0"
                class="text-[11px] text-gray-400 dark:text-gray-500 mt-1"
              >
                Add an extra monthly payment to see them diverge
              </p>
            </div>
          </div>
        </div>

        <!-- Chart -->
        <div class="card p-6 min-h-[320px] flex flex-col">
          <div class="grid grid-cols-3 items-center mb-4">
            <div class="flex flex-wrap gap-3">
              <div class="flex items-center gap-1.5">
                <div class="w-2.5 h-1.5 rounded-sm bg-blue-500 shrink-0" />
                <span class="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Avalanche</span>
              </div>
              <div class="flex items-center gap-1.5">
                <div class="w-2.5 h-1.5 rounded-sm bg-amber-500 shrink-0" />
                <span class="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Snowball</span>
              </div>
            </div>
            <h3 class="text-center font-semibold text-gray-700 dark:text-gray-200 text-sm whitespace-nowrap">
              Payoff Timeline
            </h3>
            <div class="flex justify-end">
              <select
                v-model="displayScale"
                class="text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none cursor-pointer"
              >
                <option
                  v-for="opt in scaleOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </select>
            </div>
          </div>

          <div style="height: 280px;">
            <AppChart
              :key="chartKey"
              type="line"
              :data="chartData"
              :options="chartOptions"
              :plugins="chartPlugins"
              :disable-privacy="true"
              height="280px"
            />
          </div>
        </div>

        <p
          v-if="payoffResult.capped"
          class="text-xs text-amber-600 dark:text-amber-500"
        >
          One or more debts could not be paid off within 100 years — check that minimum payments exceed monthly interest charges.
        </p>
      </div>
    </div>
  </section>
</template>
