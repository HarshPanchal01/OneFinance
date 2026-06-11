<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSettingsStore } from '@/stores/settings';
import { useFormatter } from '@/composables/useFormatter';
import AmountInput from '@/components/AmountInput.vue';
import AppChart from '@/components/AppChart.vue';

const settingsStore = useSettingsStore();
const { formatCurrency } = useFormatter();

// Inputs
const principal = ref<number | null>(300000);
const interestRate = ref<number | null>(5.5);
const interestRatePeriod = ref<'annual' | 'monthly'>('annual');
const inflationRate = ref<number | null>(2.5);
const inflationRatePeriod = ref<'annual' | 'monthly'>('annual');
const years = ref<number | null>(30);
const customMonthlyPayment = ref<number | null>(0);
const customMonthlyPaymentPeriod = ref<'annual' | 'monthly'>('monthly');
const xAxisScale = ref<'years' | 'months'>('years');

const periodOptions = [
  { label: 'Annual', value: 'annual' },
  { label: 'Monthly', value: 'monthly' }
];

const durationOptions = [
  { label: 'Years', value: 'years' },
  { label: 'Months', value: 'months' }
];

interface AmortizationResult {
  basePayment: number;
  actualPayment: number;
  hasCustomPayment: boolean;
  xScale: 'years' | 'months';
  totalInterestBase: number;
  totalInterestActual: number;
  interestSaved: number;
  monthsSaved: number;
  baseCurve: number[];
  extraCurve: number[];
  realBaseCurve: number[];
  realExtraCurve: number[];
  baseInterestAtPoint: number[];
  extraInterestAtPoint: number[];
  actualMonths: number;
  termMonths: number;
}

const amortizationData = ref<AmortizationResult | null>(null);

const calculate = () => {
  // Clamp all inputs to sane ranges
  const p = Math.max(0, Math.min(principal.value || 0, 1e8));
  const rateRaw = Math.max(0, Math.min((interestRate.value || 0), 100)) / 100;
  const rate = interestRatePeriod.value === 'monthly' ? rateRaw * 12 : rateRaw;
  const inflRaw = Math.max(0, Math.min((inflationRate.value || 0), 100)) / 100;
  const infl = inflationRatePeriod.value === 'monthly' ? inflRaw * 12 : inflRaw;
  const i = rate / 12;
  // years.value is the raw period count — months when scale is 'months', years when 'years'.
  const termMonths = xAxisScale.value === 'months'
    ? Math.max(1, Math.min(Math.floor(years.value || 1), 600))
    : Math.max(1, Math.min(Math.floor(years.value || 1), 100)) * 12;
  const userPmtRaw = Math.max(0, customMonthlyPayment.value || 0);
  const userPmt = customMonthlyPaymentPeriod.value === 'annual' ? userPmtRaw / 12 : userPmtRaw;

  if (p <= 0 || termMonths <= 0) {
    amortizationData.value = {
      basePayment: 0, actualPayment: 0, hasCustomPayment: false, xScale: xAxisScale.value,
      totalInterestBase: 0, totalInterestActual: 0,
      interestSaved: 0, monthsSaved: 0,
      baseCurve: [], extraCurve: [], realBaseCurve: [], realExtraCurve: [],
      baseInterestAtPoint: [], extraInterestAtPoint: [],
      actualMonths: 0, termMonths: 0
    };
    return;
  }

  const basePmt = i === 0
    ? p / termMonths
    : p * ((i * Math.pow(1 + i, termMonths)) / (Math.pow(1 + i, termMonths) - 1));

  // Base scenario
  let bal = p;
  let baseInterest = 0;
  const baseCurve = [bal];
  const realBaseCurve = [bal];
  const baseInterestAtPoint = [0];

  for (let m = 1; m <= termMonths; m++) {
    const interest = bal * i;
    baseInterest += interest;
    let principal_payment = basePmt - interest;
    if (bal < principal_payment) principal_payment = bal;
    bal -= principal_payment;
    if (xAxisScale.value === 'months' || m % 12 === 0 || bal <= 0.01) {
      const currentYear = m / 12;
      baseCurve.push(Math.max(0, bal));
      realBaseCurve.push(Math.max(0, bal) / Math.pow(1 + infl, currentYear));
      baseInterestAtPoint.push(baseInterest);
    }
  }

  // Accelerated scenario
  let actualBal = p;
  let actualInterest = 0;
  let actualMonths = 0;
  const extraCurve = [actualBal];
  const realExtraCurve = [actualBal];
  const extraInterestAtPoint = [0];
  const actualPmt = userPmt > 0 ? Math.max(basePmt, userPmt) : basePmt;

  while (actualBal > 0.01 && actualMonths < 1200) {
    actualMonths++;
    const interest = actualBal * i;
    actualInterest += interest;
    let principal_payment = actualPmt - interest;
    if (actualBal < principal_payment) principal_payment = actualBal;
    actualBal -= principal_payment;
    if (xAxisScale.value === 'months' || actualMonths % 12 === 0 || actualBal <= 0.01) {
      const currentYear = actualMonths / 12;
      extraCurve.push(Math.max(0, actualBal));
      realExtraCurve.push(Math.max(0, actualBal) / Math.pow(1 + infl, currentYear));
      extraInterestAtPoint.push(actualInterest);
    }
  }

  amortizationData.value = {
    basePayment: basePmt,
    actualPayment: actualPmt,
    hasCustomPayment: actualPmt > basePmt,
    xScale: xAxisScale.value,
    totalInterestBase: baseInterest,
    totalInterestActual: actualInterest,
    interestSaved: Math.max(0, baseInterest - actualInterest),
    monthsSaved: Math.max(0, termMonths - actualMonths),
    baseCurve, extraCurve, realBaseCurve, realExtraCurve,
    baseInterestAtPoint, extraInterestAtPoint,
    actualMonths, termMonths
  };
};

calculate();
const chartKey = ref(0);
const onCalculate = () => { calculate(); chartKey.value++; };

const formatTime = (totalMonths: number) => {
  if (totalMonths <= 0) return '0 mo';
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  if (y === 0) return `${m} mo`;
  if (m === 0) return `${y} yr`;
  return `${y} yr, ${m} mo`;
};

// Milestone dots every 5 years (or every 60 months) — reads data.xScale (snapshot at Calculate time),
// not xAxisScale, so toggling the scale select doesn't trigger chartData recomputation.
const milestonePointRadii = computed(() => {
  const data = amortizationData.value;
  if (!data) return [];
  const interval = data.xScale === 'months' ? 60 : 5;
  return data.baseCurve.map((_, i) => (i > 0 && i % interval === 0 ? 4 : 0));
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
  const data = amortizationData.value;
  if (!data) return { labels: [], datasets: [] };

  const maxLen = Math.max(data.baseCurve.length, data.extraCurve.length);
  const labels = Array.from({ length: maxLen }, (_, i) => `${i}`);
  const radii = milestonePointRadii.value;
  const hasCustom = data.hasCustomPayment;

  const datasets: any[] = [
    {
      type: 'line' as const,
      label: 'Balance (Base)',
      data: data.baseCurve,
      borderColor: hasCustom ? '#9ca3af' : '#3b82f6',
      backgroundColor: hasCustom ? 'rgba(156,163,175,0.08)' : 'rgba(59,130,246,0.15)',
      borderDash: hasCustom ? [5, 5] : [],
      borderWidth: 2,
      tension: 0.3,
      fill: !hasCustom,
      pointRadius: hasCustom ? 0 : radii,
      pointHitRadius: 10,
      pointHoverRadius: 5,
      pointBackgroundColor: '#3b82f6',
      pointBorderWidth: 0
    },
    {
      type: 'line' as const,
      label: 'Real Balance (Base)',
      data: data.realBaseCurve,
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245,158,11,0.06)',
      borderDash: [5, 5],
      borderWidth: 1.5,
      tension: 0.3,
      fill: false,
      pointRadius: 0,
      pointHitRadius: 10,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: '#f59e0b'
    }
  ];

  if (hasCustom) {
    datasets.push({
      type: 'line' as const,
      label: 'Balance (Accelerated)',
      data: data.extraCurve,
      borderColor: '#10b981',
      backgroundColor: 'rgba(16,185,129,0.15)',
      borderWidth: 2,
      tension: 0.3,
      fill: true,
      pointRadius: radii,
      pointHitRadius: 10,
      pointHoverRadius: 6,
      pointBackgroundColor: '#10b981',
      pointBorderWidth: 0
    });
    datasets.push({
      type: 'line' as const,
      label: 'Real Balance (Accelerated)',
      data: data.realExtraCurve,
      borderColor: '#34d399',
      backgroundColor: 'transparent',
      borderDash: [5, 5],
      borderWidth: 1.5,
      tension: 0.3,
      fill: false,
      pointRadius: 0,
      pointHitRadius: 10,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: '#34d399'
    });
  }

  return { labels, datasets };
});

const chartOptions = computed(() => {
  const privacy = settingsStore.privacyMode;
  const storedScale = amortizationData.value?.xScale ?? 'years';

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
        title: { display: true, text: storedScale === 'months' ? 'Months' : 'Years' }
      },
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Remaining Balance' },
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
            return storedScale === 'months' ? `Month ${items[0].label}` : `Year ${items[0].label}`;
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
    <!-- Header -->
    <div class="flex items-center gap-4 mb-6">
      <div class="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
        <i class="pi pi-home text-xl" />
      </div>
      <div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">
          Loan & Mortgage Amortization
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Calculate your monthly payment and simulate accelerated payoff
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <!-- Input Form -->
      <div class="bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 rounded-xl p-5 lg:col-span-1 flex flex-col gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Loan Amount:</label>
          <AmountInput
            v-model="principal"
            :show-currency="true"
            placeholder="0.00"
          />
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <label class="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">Payment Plan:</label>
            <div class="relative flex items-center group">
              <span class="absolute left-2 text-[10px] text-gray-400 pointer-events-none group-focus-within:text-primary-500">$</span>
              <input
                v-model.number="customMonthlyPayment"
                type="number"
                min="0"
                step="50"
                class="pl-5 pr-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                :style="{ width: Math.max(3, String(customMonthlyPayment ?? '').length) + 5 + 'ch' }"
              />
            </div>
            <select
              v-model="customMonthlyPaymentPeriod"
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
            v-model.number="customMonthlyPayment"
            type="range"
            min="0"
            max="10000"
            step="50"
            class="w-full h-2 bg-primary-100 dark:bg-primary-900/40 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-primary-500 [&::-webkit-slider-thumb]:dark:bg-primary-300 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-primary-500 [&::-moz-range-thumb]:dark:bg-primary-300 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:shadow-md mt-1"
          />
          <p
            v-if="amortizationData && amortizationData.basePayment > 0"
            class="text-[10px] text-gray-400 dark:text-gray-500"
          >
            Base payment: {{ formatCurrency(amortizationData.basePayment) }}/mo — enter more to accelerate payoff
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <label class="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">Interest Rate:</label>
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
            <label class="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">Loan Term:</label>
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

      <!-- Results & Chart -->
      <div class="lg:col-span-3 flex flex-col gap-4">
        <!-- Metrics Grid -->
        <div
          v-if="amortizationData"
          class="grid grid-cols-2 xl:grid-cols-4 gap-3"
        >
          <div class="card p-4">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              {{ amortizationData.hasCustomPayment ? 'Monthly Payment' : 'Base Monthly Payment' }}
            </p>
            <p
              class="text-lg font-bold text-blue-600 dark:text-blue-500 truncate"
              :class="{ 'privacy-blur': settingsStore.privacyMode }"
            >
              {{ formatCurrency(amortizationData.hasCustomPayment ? amortizationData.actualPayment : amortizationData.basePayment) }}
            </p>
          </div>
          <div class="card p-4">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Total Interest Paid
            </p>
            <p
              class="text-lg font-bold text-red-600 dark:text-red-500 truncate"
              :class="{ 'privacy-blur': settingsStore.privacyMode }"
            >
              {{ formatCurrency(amortizationData.totalInterestActual) }}
            </p>
          </div>
          <div class="card p-4">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Interest Saved
            </p>
            <p
              class="text-lg font-bold truncate transition-colors"
              :class="[amortizationData.hasCustomPayment ? 'text-emerald-600 dark:text-emerald-500' : 'text-gray-400 dark:text-gray-600', { 'privacy-blur': settingsStore.privacyMode }]"
            >
              {{ formatCurrency(amortizationData.interestSaved) }}
            </p>
          </div>
          <div class="card p-4">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Time Saved
            </p>
            <p
              class="text-lg font-bold truncate transition-colors"
              :class="amortizationData.hasCustomPayment ? 'text-emerald-600 dark:text-emerald-500' : 'text-gray-400 dark:text-gray-600'"
            >
              {{ formatTime(amortizationData.monthsSaved) }}
            </p>
          </div>
        </div>

        <!-- Chart -->
        <div class="card p-6 min-h-[380px] flex flex-col">
          <div class="grid grid-cols-3 items-center mb-4">
            <div class="flex flex-wrap gap-3">
              <div class="flex items-center gap-1.5">
                <div
                  class="shrink-0"
                  :class="amortizationData?.hasCustomPayment
                    ? 'w-2.5 h-0 border-t-2 border-dashed border-gray-400'
                    : 'w-2.5 h-1.5 rounded-sm bg-blue-500'"
                />
                <span class="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Base Balance</span>
              </div>
              <div class="flex items-center gap-1.5">
                <div class="w-2.5 h-0 border-t-2 border-amber-500 border-dashed shrink-0" />
                <span class="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Real Balance</span>
              </div>
              <template v-if="amortizationData?.hasCustomPayment">
                <div class="flex items-center gap-1.5">
                  <div class="w-2.5 h-1.5 rounded-sm bg-emerald-500 shrink-0" />
                  <span class="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Accelerated</span>
                </div>
              </template>
            </div>
            <h3 class="text-center font-semibold text-gray-700 dark:text-gray-200 text-sm whitespace-nowrap">
              Amortization Curve
            </h3>
            <div />
          </div>

          <div
            class="flex-1"
            style="min-height: 300px;"
          >
            <AppChart
              v-if="amortizationData && amortizationData.baseCurve.length > 0"
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
