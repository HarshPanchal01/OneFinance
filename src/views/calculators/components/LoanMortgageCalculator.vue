<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
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

// Calculated State
interface AmortizationResult {
  basePayment: number;
  totalInterestBase: number;
  totalInterestActual: number;
  interestSaved: number;
  monthsSaved: number;
  baseCurve: number[];
  extraCurve: number[];
  realBaseCurve: number[];
  realExtraCurve: number[];
  actualMonths: number;
  termMonths: number;
}
const amortizationData = ref<AmortizationResult | null>(null);

const calculate = () => {
  const p = principal.value || 0;
  const rateRaw = (interestRate.value || 0) / 100;
  const rate = interestRatePeriod.value === 'monthly' ? rateRaw * 12 : rateRaw;
  const inflRaw = (inflationRate.value || 0) / 100;
  const infl = inflationRatePeriod.value === 'monthly' ? inflRaw * 12 : inflRaw;
  const i = rate / 12;
  const termMonths = (years.value || 0) * 12;
  const userPmtRaw = customMonthlyPayment.value || 0;
  const userPmt = customMonthlyPaymentPeriod.value === 'annual' ? userPmtRaw / 12 : userPmtRaw;

  if (p <= 0 || termMonths <= 0) {
    amortizationData.value = {
      basePayment: 0,
      totalInterestBase: 0,
      totalInterestActual: 0,
      interestSaved: 0,
      monthsSaved: 0,
      baseCurve: [],
      extraCurve: [],
      realBaseCurve: [],
      realExtraCurve: [],
      actualMonths: 0,
      termMonths: 0
    };
    return;
  }

  const basePmt = i === 0 ? p / termMonths : p * ((i * Math.pow(1 + i, termMonths)) / (Math.pow(1 + i, termMonths) - 1));

  // Base Scenario
  let bal = p;
  let baseInterest = 0;
  const baseCurve = [bal];
  const realBaseCurve = [bal];

  for (let m = 1; m <= termMonths; m++) {
    const interest = bal * i;
    baseInterest += interest;
    let pmt = basePmt - interest;
    if (bal < pmt) pmt = bal;
    bal -= pmt;
    if (xAxisScale.value === 'months' || m % 12 === 0 || bal === 0) {
      const currentYear = m / 12;
      baseCurve.push(bal);
      realBaseCurve.push(bal / Math.pow(1 + infl, currentYear));
    }
  }

  // Extra Scenario
  let actualBal = p;
  let actualInterest = 0;
  let actualMonths = 0;
  const extraCurve = [actualBal];
  const realExtraCurve = [actualBal];
  const actualPmt = userPmt > 0 ? Math.max(basePmt, userPmt) : basePmt;

  // Safeguard against infinite loops (max 100 years)
  while (actualBal > 0 && actualMonths < 1200) {
    actualMonths++;
    const interest = actualBal * i;
    actualInterest += interest;
    let pmt = actualPmt - interest;
    if (actualBal < pmt) pmt = actualBal;
    actualBal -= pmt;
    if (xAxisScale.value === 'months' || actualMonths % 12 === 0 || actualBal === 0) {
      const currentYear = actualMonths / 12;
      extraCurve.push(actualBal);
      realExtraCurve.push(actualBal / Math.pow(1 + infl, currentYear));
    }
  }

  amortizationData.value = {
    basePayment: basePmt,
    totalInterestBase: baseInterest,
    totalInterestActual: actualInterest,
    interestSaved: Math.max(0, baseInterest - actualInterest),
    monthsSaved: Math.max(0, termMonths - actualMonths),
    baseCurve,
    extraCurve,
    realBaseCurve,
    realExtraCurve,
    actualMonths,
    termMonths
  };
};

onMounted(() => {
  calculate();
});

const formatTime = (totalMonths: number) => {
  if (totalMonths <= 0) return '0 mo';
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  if (y === 0) return `${m} mo`;
  if (m === 0) return `${y} yr`;
  return `${y} yr, ${m} mo`;
};

// Chart Configuration
const chartData = computed(() => {
  const data = amortizationData.value;
  if (!data) return { labels: [], datasets: [] };

  const baseLen = data.baseCurve.length;
  const extraLen = data.extraCurve.length;
  const maxLen = Math.max(baseLen, extraLen);
  
  const labels = [];
  for (let i = 0; i < maxLen; i++) {
    labels.push(`${i}`);
  }

  const datasets: any[] = [
    {
      type: 'line' as const,
      label: 'Balance (Base)',
      data: data.baseCurve,
      borderColor: '#9ca3af', // gray-400
      backgroundColor: 'rgba(156, 163, 175, 0.1)',
      borderDash: [5, 5],
      borderWidth: 2,
      tension: 0.3,
      fill: false,
      pointRadius: 0,
      pointHoverRadius: 5
    },
    {
      type: 'line' as const,
      label: 'Real Balance (Base)',
      data: data.realBaseCurve,
      borderColor: '#f59e0b', // amber-500
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderDash: [5, 5],
      borderWidth: 1.5,
      tension: 0.3,
      fill: false,
      pointRadius: 0,
      pointHoverRadius: 5
    }
  ];

  if ((customMonthlyPayment.value || 0) > 0) {
    datasets.push({
      type: 'line' as const,
      label: 'Balance (Custom)',
      data: data.extraCurve,
      borderColor: '#10b981', // emerald-500
      backgroundColor: 'rgba(16, 185, 129, 0.2)',
      borderWidth: 2,
      tension: 0.3,
      fill: true,
      pointRadius: 0,
      pointHoverRadius: 5
    });
    datasets.push({
      type: 'line' as const,
      label: 'Real Balance (Custom)',
      data: data.realExtraCurve,
      borderColor: '#34d399', // emerald-400
      backgroundColor: 'transparent',
      borderDash: [5, 5],
      borderWidth: 1.5,
      tension: 0.3,
      fill: false,
      pointRadius: 0,
      pointHoverRadius: 5
    });

    // If custom payment is active, make base solid gray instead of blue
    datasets[0].borderColor = '#9ca3af';
    datasets[0].fill = false;
  } else {
    // If no custom payment, make base solid blue
    datasets[0].borderColor = '#3b82f6'; // blue-500
    datasets[0].backgroundColor = 'rgba(59, 130, 246, 0.2)';
    datasets[0].borderDash = [];
    datasets[0].fill = true;
    
    // Also style the real curve to match
    datasets[1].borderDash = [5, 5];
  }

  return { labels, datasets };
});

const chartOptions = computed(() => {
  return {
    scales: {
      x: {
        grid: { display: false },
        title: {
          display: true,
          text: xAxisScale.value === 'months' ? 'Months' : 'Years'
        }
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Remaining Balance'
        },
        ticks: {
          callback: (value: any) => formatCurrency(value)
        }
      }
    },
    plugins: {
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: (context: any) => {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            if (context.parsed.y !== null) {
              label += formatCurrency(context.parsed.y);
            }
            return label;
          }
        }
      },
      legend: {
        display: false
      }
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false
    },
    maintainAspectRatio: false,
    responsive: true
  };
});
</script>

<template>
  <section class="flex flex-col h-full overflow-hidden">
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
      <!-- Input Form (1 Column) -->
      <div class="bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 rounded-xl p-5 lg:col-span-1 space-y-5 flex flex-col">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Loan Amount (Principal):</label>
          <AmountInput
            v-model="principal"
            :show-currency="true"
            placeholder="0.00"
          />
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Payment Plan:</label>
              <div class="relative flex items-center group">
                <span class="absolute left-2 text-[10px] text-gray-400 pointer-events-none group-focus-within:text-primary-500">$</span>
                <input 
                  v-model.number="customMonthlyPayment" 
                  type="number" 
                  min="0"
                  step="50"
                  class="pl-5 pr-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all" 
                  :style="{ width: (String(customMonthlyPayment).length + 7) + 'ch' }"
                />
              </div>
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
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Interest Rate:</label>
              <div class="relative flex items-center group">
                <input 
                  v-model.number="interestRate" 
                  type="number" 
                  min="0"
                  step="0.1"
                  class="pl-2 pr-5 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all" 
                  :style="{ width: (String(interestRate).length + 7) + 'ch' }"
                />
                <span class="absolute right-2 text-[10px] text-gray-400 pointer-events-none group-focus-within:text-primary-500">%</span>
              </div>
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
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Inflation Rate:</label>
              <div class="relative flex items-center group">
                <input 
                  v-model.number="inflationRate" 
                  type="number" 
                  min="0"
                  step="0.1"
                  class="pl-2 pr-5 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all" 
                  :style="{ width: (String(inflationRate).length + 7) + 'ch' }"
                />
                <span class="absolute right-2 text-[10px] text-gray-400 pointer-events-none group-focus-within:text-primary-500">%</span>
              </div>
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
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Loan Term:</label>
              <input 
                v-model.number="years" 
                type="number" 
                min="1"
                max="100"
                class="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all" 
                :style="{ width: (String(years).length + 7) + 'ch' }"
              />
            </div>
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
            max="100"
            class="w-full h-2 bg-primary-100 dark:bg-primary-900/40 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-primary-500 [&::-webkit-slider-thumb]:dark:bg-primary-300 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-primary-500 [&::-moz-range-thumb]:dark:bg-primary-300 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:shadow-md mt-1" 
          />
        </div>

        <div class="pt-2 flex justify-center mt-auto">
          <button 
            class="px-4 py-2 bg-primary-500 dark:bg-primary-900/40 text-white dark:text-primary-300 hover:bg-primary-600 dark:hover:bg-primary-900/60 rounded-lg transition-colors w-full sm:w-auto"
            @click="calculate"
          >
            Calculate
          </button>
        </div>
      </div>

      <!-- Results & Chart (3 Columns) -->
      <div class="lg:col-span-3 flex flex-col gap-4">
        <!-- Metrics Grid -->
        <div
          v-if="amortizationData"
          class="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <!-- Base Monthly Payment -->
          <div class="card p-4">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Base Monthly Payment
            </p>
            <p
              class="text-xl font-bold text-blue-600 dark:text-blue-500"
              :class="{ 'privacy-blur': settingsStore.privacyMode }"
            >
              {{ formatCurrency(amortizationData.basePayment) }}
            </p>
          </div>
          <!-- Total Interest -->
          <div class="card p-4">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Total Interest Paid
            </p>
            <p
              class="text-xl font-bold text-red-600 dark:text-red-500"
              :class="{ 'privacy-blur': settingsStore.privacyMode }"
            >
              {{ formatCurrency(amortizationData.totalInterestActual) }}
            </p>
          </div>
          <!-- Interest Saved -->
          <div class="card p-4">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Interest Saved
            </p>
            <p
              class="text-xl font-bold transition-colors"
              :class="[(customMonthlyPayment || 0) > 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-gray-400 dark:text-gray-600', { 'privacy-blur': settingsStore.privacyMode }]"
            >
              {{ formatCurrency(amortizationData.interestSaved) }}
            </p>
          </div>
          <!-- Time Saved -->
          <div class="card p-4">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Time Saved
            </p>
            <p
              class="text-xl font-bold transition-colors"
              :class="[(customMonthlyPayment || 0) > 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-gray-400 dark:text-gray-600', { 'privacy-blur': settingsStore.privacyMode }]"
            >
              {{ formatTime(amortizationData.monthsSaved) }}
            </p>
          </div>
        </div>

        <!-- Chart Section -->
        <div class="card p-6 flex-1 min-h-[400px] flex flex-col relative overflow-hidden">
          <div class="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
            <!-- Custom Legend (Left) -->
            <div class="hidden md:flex flex-wrap gap-4 z-10">
              <div class="flex items-center gap-1.5">
                <div
                  class="w-2.5 h-0 border-t-2 border-dashed shrink-0"
                  :class="(customMonthlyPayment || 0) > 0 ? 'border-gray-400' : 'border-blue-500 border-solid border-t-4 rounded-sm h-1.5 w-2.5 border-none bg-blue-500'"
                />
                <span class="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Base Balance</span>
              </div>
              <div class="flex items-center gap-1.5">
                <div class="w-2.5 h-0 border-t-2 border-amber-500 border-dashed shrink-0" />
                <span class="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Real Base Balance</span>
              </div>
              <div
                v-if="(customMonthlyPayment || 0) > 0"
                class="flex items-center gap-1.5"
              >
                <div class="w-2.5 h-1.5 rounded-sm bg-emerald-500 shrink-0" />
                <span class="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Custom Balance</span>
              </div>
              <div
                v-if="(customMonthlyPayment || 0) > 0"
                class="flex items-center gap-1.5"
              >
                <div class="w-2.5 h-0 border-t-2 border-[#34d399] border-dashed shrink-0" />
                <span class="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Real Custom Balance</span>
              </div>
            </div>

            <!-- Title (Centered) -->
            <h3 class="absolute left-1/2 -translate-x-1/2 font-semibold text-gray-700 dark:text-gray-200 text-sm lg:text-base whitespace-nowrap z-0">
              Amortization Curve
            </h3>
          </div>

          <div class="flex-1 min-h-0">
            <AppChart
              v-if="amortizationData && amortizationData.baseCurve.length > 0"
              type="line"
              :data="chartData"
              :options="chartOptions"
              height="100%"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
