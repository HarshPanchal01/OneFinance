<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSettingsStore } from '@/stores/settings';
import { useFormatter } from '@/composables/useFormatter';
import AmountInput from '@/components/AmountInput.vue';
import AppChart from '@/components/AppChart.vue';
import ErrorModal from '@/components/ErrorModal.vue';

const settingsStore = useSettingsStore();
const { formatCurrency } = useFormatter();
const errorModal = ref<InstanceType<typeof ErrorModal> | null>(null);

// Inputs — all null on startup; state is preserved across navigation via v-show in App.vue
const principal = ref<number | null>(null);
const monthlyContribution = ref<number | null>(null);
const contributionPeriod = ref<'annual' | 'monthly'>('monthly');
const interestRate = ref<number | null>(null);
const interestRatePeriod = ref<'annual' | 'monthly'>('annual');
const inflationRate = ref<number | null>(null);
const inflationRatePeriod = ref<'annual' | 'monthly'>('annual');
const years = ref<number | null>(null);
const xAxisScale = ref<'years' | 'months'>('years');

const periodOptions = [
  { label: 'Annual', value: 'annual' },
  { label: 'Monthly', value: 'monthly' }
];

const durationOptions = [
  { label: 'Years', value: 'years' },
  { label: 'Months', value: 'months' }
];

interface ProjectionPoint {
  year: number;
  label: string;
  totalContributions: number;
  totalInterest: number;
  balance: number;
  realBalance: number;
}

const projectionData = ref<ProjectionPoint[]>([]);

const calculate = () => {
  const data: ProjectionPoint[] = [];
  // Clamp all inputs to sane ranges — guards against negative, NaN, or absurd values
  const p = Math.max(0, Math.min(principal.value || 0, 1e9));
  const contribRaw = Math.max(0, Math.min(monthlyContribution.value || 0, 1e6));
  const pmt = contributionPeriod.value === 'annual' ? contribRaw / 12 : contribRaw;

  const rateRaw = Math.max(0, Math.min((interestRate.value || 0), 200)) / 100;
  const rate = interestRatePeriod.value === 'monthly' ? rateRaw * 12 : rateRaw;
  const inflRaw = Math.max(0, Math.min((inflationRate.value || 0), 100)) / 100;
  const infl = inflationRatePeriod.value === 'monthly' ? inflRaw * 12 : inflRaw;

  const monthlyRate = rate / 12;
  // years.value is the raw period count — months when scale is 'months', years when 'years'.
  // Never multiply by 12 here; do it only in years mode.
  const totalMonths = xAxisScale.value === 'months'
    ? Math.max(1, Math.min(Math.floor(years.value || 1), 600))
    : Math.max(1, Math.min(Math.floor(years.value || 1), 100)) * 12;

  data.push({ year: 0, label: '0', totalContributions: p, totalInterest: 0, balance: p, realBalance: p });

  let totalContrib = p;
  let accumulatedInterest = 0;
  let balance = p;

  for (let m = 1; m <= totalMonths; m++) {
    const interestForMonth = balance * monthlyRate;
    accumulatedInterest += interestForMonth;
    balance += interestForMonth + pmt;
    totalContrib += pmt;

    if (xAxisScale.value === 'months') {
      data.push({
        year: Math.ceil(m / 12),
        label: `${m}`,
        totalContributions: totalContrib,
        totalInterest: accumulatedInterest,
        balance,
        realBalance: balance / Math.pow(1 + infl, m / 12)
      });
    } else if (m % 12 === 0) {
      data.push({
        year: m / 12,
        label: `${m / 12}`,
        totalContributions: totalContrib,
        totalInterest: accumulatedInterest,
        balance,
        realBalance: balance / Math.pow(1 + infl, m / 12)
      });
    }
  }
  projectionData.value = data;
};

// Snapshot of xAxisScale at the time Calculate was last clicked.
// Prevents milestonePointRadii and chartOptions from reacting to the scale toggle directly.
const calculatedScale = ref<'years' | 'months'>('years');
const hasCalculated = ref(false);
const chartKey = ref(0);
const isExpanded = ref(true);

const showError = (message: string) => {
  errorModal.value?.openConfirmation({ title: 'Invalid Input', message });
};

const onCalculate = () => {
  const p = principal.value ?? 0;
  const contrib = monthlyContribution.value ?? 0;
  const rate = interestRate.value ?? 0;
  const infl = inflationRate.value ?? 0;
  const y = years.value ?? 0;

  if (p < 0) { showError('Initial Principal cannot be negative.'); return; }
  if (contrib < 0) { showError('Contribution amount cannot be negative.'); return; }
  if (rate < 0) { showError('Return rate cannot be negative.'); return; }
  if (infl < 0) { showError('Inflation rate cannot be negative.'); return; }
  if (y <= 0) {
    showError(`${xAxisScale.value === 'months' ? 'Months' : 'Years'} to grow must be greater than zero.`);
    return;
  }
  if (p === 0 && contrib === 0) {
    showError('Enter an Initial Principal or a Contribution amount to project growth.');
    return;
  }

  calculate();
  calculatedScale.value = xAxisScale.value;
  hasCalculated.value = true;
  chartKey.value++;
};

const futureValue = computed(() => projectionData.value.at(-1)?.balance ?? 0);
const realValue = computed(() => projectionData.value.at(-1)?.realBalance ?? 0);
const totalContributions = computed(() => projectionData.value.at(-1)?.totalContributions ?? 0);
const totalInterest = computed(() => projectionData.value.at(-1)?.totalInterest ?? 0);
const totalReturnPercent = computed(() =>
  totalContributions.value > 0 ? (totalInterest.value / totalContributions.value) * 100 : 0
);

// Milestone dots every 5 years (or every 60 months) — reads calculatedScale, not xAxisScale,
// so toggling the scale select doesn't trigger chartData recomputation before Calculate is clicked.
const milestonePointRadii = computed(() => {
  const interval = calculatedScale.value === 'months' ? 60 : 5;
  return projectionData.value.map((_, i) => (i > 0 && i % interval === 0 ? 4 : 0));
});

// Vertical crosshair line rendered after each chart draw
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
  const data = projectionData.value;
  const radii = milestonePointRadii.value;
  return {
    labels: data.map(d => d.label),
    datasets: [
      {
        type: 'line' as const,
        label: 'Real Value (Inflation-Adjusted)',
        data: data.map(d => d.realBalance),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        borderDash: [5, 5],
        borderWidth: 1.5,
        tension: 0.3,
        fill: false,
        pointRadius: 0,
        pointHitRadius: 10,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#f59e0b'
      },
      {
        type: 'line' as const,
        label: 'Total Contributions',
        data: data.map(d => d.totalContributions),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        borderWidth: 2,
        tension: 0.3,
        fill: true,
        pointRadius: 0,
        pointHitRadius: 10,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#3b82f6'
      },
      {
        type: 'line' as const,
        label: 'Total Value (Future Value)',
        data: data.map(d => d.balance),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderWidth: 2,
        tension: 0.3,
        fill: true,
        pointRadius: radii,
        pointHitRadius: 10,
        pointHoverRadius: 6,
        pointBackgroundColor: '#10b981',
        pointBorderWidth: 0
      }
    ]
  };
});

const chartOptions = computed(() => {
  const privacy = settingsStore.privacyMode;
  return {
    animations: {
      y: {
        duration: 800,
        easing: 'easeOutQuart' as const,
        from: (ctx: any) => ctx.chart.scales?.y?.getPixelForValue?.(0) ?? 0
      }
    },
    scales: {
      x: {
        grid: { display: false },
        title: { display: true, text: calculatedScale.value === 'months' ? 'Months' : 'Years' }
      },
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Amount' },
        ticks: {
          callback: (value: any) => privacy ? '****' : formatCurrency(value)
        }
      }
    },
    plugins: {
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          title: (items: any[]) => {
            if (!items.length) return '';
            return calculatedScale.value === 'months' ? `Month ${items[0].label}` : `Year ${items[0].label}`;
          },
          label: (context: any) => {
            const label = context.dataset.label || '';
            const value = privacy ? '****' : formatCurrency(context.parsed.y ?? 0);
            return `${label}: ${value}`;
          }
        }
      },
      legend: { display: false }
    },
    interaction: { mode: 'nearest' as const, axis: 'x' as const, intersect: false },
    maintainAspectRatio: false,
    responsive: true
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
      <div class="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-400">
        <i class="pi pi-chart-line text-xl" />
      </div>
      <div class="flex-1">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">
          Compound Interest
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Project your investment growth over time
        </p>
      </div>
      <i
        class="pi transition-transform duration-200 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 mr-1"
        :class="isExpanded ? 'pi-chevron-down' : 'pi-chevron-right'"
      />
    </div>

    <div
      v-show="isExpanded"
      class="grid grid-cols-1 lg:grid-cols-4 gap-4"
    >
      <!-- Input Form -->
      <div class="bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 rounded-xl p-5 lg:col-span-1 flex flex-col gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Initial Principal:</label>
          <AmountInput
            v-model="principal"
            :show-currency="true"
            placeholder="0.00"
          />
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <label class="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">Contribution Plan:</label>
            <div class="relative flex items-center group">
              <span class="absolute left-2 text-[10px] text-gray-400 pointer-events-none group-focus-within:text-primary-500">$</span>
              <input
                v-model.number="monthlyContribution"
                type="number"
                min="0"
                step="10"
                class="pl-5 pr-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                :style="{ width: Math.max(3, String(monthlyContribution ?? '').length) + 5 + 'ch' }"
              />
            </div>
            <select
              v-model="contributionPeriod"
              class="text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none cursor-pointer"
            >
              <option
                v-for="opt in periodOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
          </div>
          <input
            v-model.number="monthlyContribution"
            type="range"
            min="0"
            max="5000"
            step="50"
            class="w-full h-2 bg-primary-100 dark:bg-primary-900/40 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-primary-500 [&::-webkit-slider-thumb]:dark:bg-primary-300 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-primary-500 [&::-moz-range-thumb]:dark:bg-primary-300 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:shadow-md mt-1"
          />
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <label class="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">Return Rate:</label>
            <div class="relative flex items-center group">
              <input
                v-model.number="interestRate"
                type="number"
                min="0"
                step="0.1"
                class="pl-2 pr-5 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                :style="{ width: Math.max(3, String(interestRate ?? '').length) + 5 + 'ch' }"
              />
              <span class="absolute right-2 text-[10px] text-gray-400 pointer-events-none group-focus-within:text-primary-500">%</span>
            </div>
            <select
              v-model="interestRatePeriod"
              class="text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none cursor-pointer"
            >
              <option
                v-for="opt in periodOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
          </div>
          <input
            v-model.number="interestRate"
            type="range"
            min="0"
            max="30"
            step="0.1"
            class="w-full h-2 bg-primary-100 dark:bg-primary-900/40 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-primary-500 [&::-webkit-slider-thumb]:dark:bg-primary-300 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-primary-500 [&::-moz-range-thumb]:dark:bg-primary-300 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:shadow-md mt-1"
          />
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <label class="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">Inflation Rate:</label>
            <div class="relative flex items-center group">
              <input
                v-model.number="inflationRate"
                type="number"
                min="0"
                step="0.1"
                class="pl-2 pr-5 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                :style="{ width: Math.max(3, String(inflationRate ?? '').length) + 5 + 'ch' }"
              />
              <span class="absolute right-2 text-[10px] text-gray-400 pointer-events-none group-focus-within:text-primary-500">%</span>
            </div>
            <select
              v-model="inflationRatePeriod"
              class="text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none cursor-pointer"
            >
              <option
                v-for="opt in periodOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
          </div>
          <input
            v-model.number="inflationRate"
            type="range"
            min="0"
            max="20"
            step="0.1"
            class="w-full h-2 bg-primary-100 dark:bg-primary-900/40 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-primary-500 [&::-webkit-slider-thumb]:dark:bg-primary-300 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-primary-500 [&::-moz-range-thumb]:dark:bg-primary-300 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:shadow-md mt-1"
          />
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <label class="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">Time to Grow:</label>
            <input
              v-model.number="years"
              type="number"
              min="1"
              :max="xAxisScale === 'months' ? 600 : 100"
              class="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
              :style="{ width: Math.max(3, String(years ?? '').length) + 4 + 'ch' }"
            />
            <select
              v-model="xAxisScale"
              class="text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none cursor-pointer"
            >
              <option
                v-for="opt in durationOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
          </div>
          <input
            v-model.number="years"
            type="range"
            min="1"
            :max="xAxisScale === 'months' ? 600 : 100"
            class="w-full h-2 bg-primary-100 dark:bg-primary-900/40 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-primary-500 [&::-webkit-slider-thumb]:dark:bg-primary-300 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-primary-500 [&::-moz-range-thumb]:dark:bg-primary-300 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:shadow-md mt-1"
          />
        </div>
        <div class="flex justify-center my-auto">
          <button
            class="px-4 py-2 bg-primary-500 dark:bg-primary-900/40 text-white dark:text-primary-300 hover:bg-primary-600 dark:hover:bg-primary-900/60 rounded-lg transition-colors font-medium text-sm"
            @click="onCalculate"
          >
            Calculate
          </button>
        </div>
      </div>

      <!-- Placeholder before first calculation -->
      <div
        v-if="!hasCalculated"
        class="lg:col-span-3 flex items-center justify-center rounded-xl border border-dashed border-gray-200 dark:border-gray-700"
      >
        <div class="text-center py-12">
          <i class="pi pi-chart-line text-4xl text-gray-300 dark:text-gray-600 mb-3 block" />
          <p class="text-sm text-gray-400 dark:text-gray-500">
            Enter your details and click Calculate to see projections
          </p>
        </div>
      </div>

      <!-- Results & Chart -->
      <div
        v-else
        class="lg:col-span-3 flex flex-col gap-4"
      >
        <!-- Metrics Grid -->
        <div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
          <div class="card p-4">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Future Value
            </p>
            <p
              class="text-lg font-bold text-gray-900 dark:text-white truncate"
              :class="{ 'privacy-blur': settingsStore.privacyMode }"
            >
              {{ formatCurrency(futureValue) }}
            </p>
          </div>
          <div class="card p-4">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Real Value
            </p>
            <p
              class="text-lg font-bold text-amber-600 dark:text-amber-500 truncate"
              :class="{ 'privacy-blur': settingsStore.privacyMode }"
            >
              {{ formatCurrency(realValue) }}
            </p>
          </div>
          <div class="card p-4">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Contributions
            </p>
            <p
              class="text-lg font-bold text-blue-600 dark:text-blue-500 truncate"
              :class="{ 'privacy-blur': settingsStore.privacyMode }"
            >
              {{ formatCurrency(totalContributions) }}
            </p>
          </div>
          <div class="card p-4">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Interest Earned
            </p>
            <p
              class="text-lg font-bold text-emerald-600 dark:text-emerald-500 truncate"
              :class="{ 'privacy-blur': settingsStore.privacyMode }"
            >
              {{ formatCurrency(totalInterest) }}
            </p>
          </div>
          <div class="card p-4">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Total Return
            </p>
            <p
              class="text-lg font-bold text-emerald-600 dark:text-emerald-500 truncate"
              :class="{ 'privacy-blur': settingsStore.privacyMode }"
            >
              +{{ totalReturnPercent.toFixed(1) }}%
            </p>
          </div>
        </div>

        <!-- Chart -->
        <div class="card p-6 min-h-[380px] flex flex-col">
          <div class="grid grid-cols-3 items-center mb-4">
            <div class="flex flex-wrap gap-3">
              <div class="flex items-center gap-1.5">
                <div class="w-2.5 h-0 border-t-2 border-amber-500 border-dashed shrink-0" />
                <span class="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Real Value</span>
              </div>
              <div class="flex items-center gap-1.5">
                <div class="w-2.5 h-1.5 rounded-sm bg-blue-500 shrink-0" />
                <span class="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Contributions</span>
              </div>
              <div class="flex items-center gap-1.5">
                <div class="w-2.5 h-1.5 rounded-sm bg-emerald-500 shrink-0" />
                <span class="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Future Value</span>
              </div>
            </div>
            <h3 class="text-center font-semibold text-gray-700 dark:text-gray-200 text-sm whitespace-nowrap">
              Investment Growth Over Time
            </h3>
            <div />
          </div>

          <div
            class="flex-1"
            style="min-height: 300px;"
          >
            <AppChart
              v-if="projectionData.length > 0"
              :key="chartKey"
              type="line"
              :data="chartData"
              :options="chartOptions"
              :plugins="chartPlugins"
              height="100%"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
