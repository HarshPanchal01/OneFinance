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
const inflationRate = ref<number | null>(2.5);
const years = ref<number | null>(30);
const extraPayment = ref<number | null>(0);

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
  const rate = (interestRate.value || 0) / 100;
  const infl = (inflationRate.value || 0) / 100;
  const i = rate / 12;
  const termMonths = (years.value || 0) * 12;
  const extra = extraPayment.value || 0;

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
    if (m % 12 === 0 || bal === 0) {
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
  const actualPmt = basePmt + extra;

  // Safeguard against infinite loops (max 100 years)
  while (actualBal > 0 && actualMonths < 1200) {
    actualMonths++;
    const interest = actualBal * i;
    actualInterest += interest;
    let pmt = actualPmt - interest;
    if (actualBal < pmt) pmt = actualBal;
    actualBal -= pmt;
    if (actualMonths % 12 === 0 || actualBal === 0) {
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
    labels.push(`Year ${i}`);
  }

  const datasets: any[] = [
    {
      label: 'Balance (Base)',
      data: data.baseCurve,
      borderColor: '#9ca3af', // gray-400
      backgroundColor: 'rgba(156, 163, 175, 0.1)',
      borderDash: [5, 5],
      tension: 0.1,
      fill: false,
      pointRadius: 0,
      pointHoverRadius: 5
    },
    {
      label: 'Real Balance (Base)',
      data: data.realBaseCurve,
      borderColor: '#f59e0b', // amber-500
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderDash: [5, 5],
      tension: 0.1,
      fill: false,
      pointRadius: 0,
      pointHoverRadius: 5
    }
  ];

  if ((extraPayment.value || 0) > 0) {
    datasets.push({
      label: 'Balance (With Extra)',
      data: data.extraCurve,
      borderColor: '#10b981', // emerald-500
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      tension: 0.1,
      fill: true,
      pointRadius: 0,
      pointHoverRadius: 5
    });
    datasets.push({
      label: 'Real Balance (With Extra)',
      data: data.realExtraCurve,
      borderColor: '#34d399', // emerald-400
      backgroundColor: 'rgba(52, 211, 153, 0.1)',
      tension: 0.1,
      fill: false,
      pointRadius: 0,
      pointHoverRadius: 5
    });
  } else {
    // If no extra payment, make the base curve the primary active line
    datasets[0].borderColor = '#3b82f6';
    datasets[0].backgroundColor = 'rgba(59, 130, 246, 0.1)';
    datasets[0].borderDash = [];
    datasets[0].fill = true;
    
    // Also style the real curve to match
    datasets[1].borderDash = [];
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
          text: 'Years'
        }
      },
      y: { 
        beginAtZero: true,
        title: {
          display: true,
          text: 'Remaining Balance'
        }
      }
    },
    plugins: {
      tooltip: {
        mode: 'index',
        intersect: false
      },
      legend: {
        display: false
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  } as any;
});
</script>

<template>
  <section>
    <div class="flex items-center gap-3 mb-4">
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
      <div class="bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 rounded-xl p-5 lg:col-span-1 space-y-5">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Loan Amount (Principal)</label>
          <AmountInput
            v-model="principal"
            :show-currency="true"
            placeholder="0.00"
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Annual Interest Rate (%)</label>
          <div class="relative group">
            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none group-focus-within:text-primary-500 transition-colors">%</span>
            <input 
              v-model.number="interestRate" 
              type="number" 
              min="0"
              step="0.1"
              class="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none" 
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Est. Inflation Rate (%)</label>
          <div class="relative group">
            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none group-focus-within:text-primary-500 transition-colors">%</span>
            <input 
              v-model.number="inflationRate" 
              type="number" 
              min="0"
              step="0.1"
              class="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none" 
            />
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Loan Term (Years)</label>
          <input 
            v-model.number="years" 
            type="number" 
            min="1"
            max="100"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none" 
          />
        </div>

        <div class="pt-2 border-t border-gray-200 dark:border-gray-700">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Monthly Payment</label>
          <AmountInput
            v-model="extraPayment"
            :show-currency="true"
            placeholder="0.00"
          />
          <p class="text-xs text-gray-500 mt-1.5 mb-4">
            Total principal paid each month to accelerate payoff.
          </p>
          <div class="flex justify-center">
            <button 
              class="px-4 py-2 bg-primary-500 dark:bg-primary-900/40 text-white dark:text-primary-300 hover:bg-primary-600 dark:hover:bg-primary-900/60 rounded-lg transition-colors w-full sm:w-auto"
              @click="calculate"
            >
              Calculate
            </button>
          </div>
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
              class="text-2xl font-bold text-gray-900 dark:text-white"
              :class="{ 'privacy-blur': settingsStore.privacyMode }"
            >
              {{ formatCurrency(amortizationData.basePayment) }}
            </p>
          </div>
          <!-- Total Interest -->
          <div class="card p-4">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Total Interest
            </p>
            <p
              class="text-xl font-bold text-gray-900 dark:text-gray-300"
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
              :class="[(extraPayment || 0) > 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-gray-400 dark:text-gray-600', { 'privacy-blur': settingsStore.privacyMode }]"
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
              :class="[(extraPayment || 0) > 0 ? 'text-blue-600 dark:text-blue-500' : 'text-gray-400 dark:text-gray-600']"
            >
              {{ formatTime(amortizationData.monthsSaved) }}
            </p>
          </div>
        </div>

        <!-- Chart -->
        <div
          v-if="amortizationData"
          class="card flex-1 w-full min-h-[350px] p-4 flex flex-col relative"
        >
          <div class="relative flex items-center justify-end mb-4 shrink-0 min-h-[32px]">
            <!-- Custom Legend (Left) -->
            <div class="hidden xl:flex flex-row gap-4 absolute left-0">
              <div class="flex items-center gap-1.5">
                <div class="w-2.5 h-0 border-t-2 border-gray-400 border-dashed shrink-0" />
                <span class="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Balance (Base)</span>
              </div>
              <div
                v-if="(extraPayment || 0) > 0"
                class="flex items-center gap-1.5"
              >
                <div class="w-2.5 h-1.5 rounded-sm bg-emerald-500 shrink-0" />
                <span class="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Balance (With Extra)</span>
              </div>
            </div>

            <h3 class="absolute left-1/2 -translate-x-1/2 font-semibold text-gray-700 dark:text-gray-200 text-sm lg:text-base text-center whitespace-nowrap pointer-events-none hidden sm:block">
              Amortization Curve
            </h3>
            <h3 class="absolute left-0 font-semibold text-gray-700 dark:text-gray-200 text-sm lg:text-base text-center whitespace-nowrap pointer-events-none block sm:hidden">
              Amortization Curve
            </h3>
          </div>
          <div class="flex-1 min-h-0">
            <AppChart
              v-if="amortizationData.baseCurve.length > 0"
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
