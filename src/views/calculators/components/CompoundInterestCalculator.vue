<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useSettingsStore } from '@/stores/settings';
import { useFormatter } from '@/composables/useFormatter';
import AmountInput from '@/components/AmountInput.vue';
import AppChart from '@/components/AppChart.vue';

const settingsStore = useSettingsStore();
const { formatCurrency } = useFormatter();

// Inputs
const principal = ref<number | null>(10000);
const monthlyContribution = ref<number | null>(500);
const contributionPeriod = ref<'annual' | 'monthly'>('monthly');
const interestRate = ref<number | null>(7);
const interestRatePeriod = ref<'annual' | 'monthly'>('annual');
const inflationRate = ref<number | null>(2.5);
const inflationRatePeriod = ref<'annual' | 'monthly'>('annual');
const years = ref<number | null>(10);
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
  const p = principal.value || 0;
  const contribRaw = monthlyContribution.value || 0;
  const pmt = contributionPeriod.value === 'annual' ? contribRaw / 12 : contribRaw;
  
  const rateRaw = (interestRate.value || 0) / 100;
  const rate = interestRatePeriod.value === 'monthly' ? rateRaw * 12 : rateRaw;
  const inflRaw = (inflationRate.value || 0) / 100;
  const infl = inflationRatePeriod.value === 'monthly' ? inflRaw * 12 : inflRaw;
  
  const monthlyRate = rate / 12;
  const yCount = years.value || 0;
  
  // Year 0
  data.push({
    year: 0,
    label: '0',
    totalContributions: p,
    totalInterest: 0,
    balance: p,
    realBalance: p
  });

  let totalContrib = p;
  let accumulatedInterest = 0;
  let balance = p;

  for (let y = 1; y <= yCount; y++) {
    for (let m = 0; m < 12; m++) {
      const interestForMonth = balance * monthlyRate;
      accumulatedInterest += interestForMonth;
      balance += interestForMonth + pmt;
      totalContrib += pmt;
      
      if (xAxisScale.value === 'months') {
        const monthIndex = (y - 1) * 12 + m + 1;
        data.push({
          year: y,
          label: `${monthIndex}`,
          totalContributions: totalContrib,
          totalInterest: accumulatedInterest,
          balance: balance,
          realBalance: balance / Math.pow(1 + infl, monthIndex / 12)
        });
      }
    }
    
    if (xAxisScale.value === 'years') {
      data.push({
        year: y,
        label: `${y}`,
        totalContributions: totalContrib,
        totalInterest: accumulatedInterest,
        balance: balance,
        realBalance: balance / Math.pow(1 + infl, y)
      });
    }
  }
  projectionData.value = data;
};

onMounted(() => {
  calculate();
});

const futureValue = computed(() => {
  const data = projectionData.value;
  return data.length > 0 ? data[data.length - 1].balance : 0;
});

const realValue = computed(() => {
  const data = projectionData.value;
  return data.length > 0 ? data[data.length - 1].realBalance : 0;
});

const totalContributions = computed(() => {
  const data = projectionData.value;
  return data.length > 0 ? data[data.length - 1].totalContributions : 0;
});

const totalInterest = computed(() => {
  const data = projectionData.value;
  return data.length > 0 ? data[data.length - 1].totalInterest : 0;
});

const totalReturnPercent = computed(() => {
  if (totalContributions.value <= 0) return 0;
  return (totalInterest.value / totalContributions.value) * 100;
});

// Chart Configuration
const chartData = computed(() => {
  const data = projectionData.value;
  return {
    labels: data.map(d => d.label),
    datasets: [
      {
        type: 'line' as const,
        label: 'Real Value (Adjusted for Inflation)',
        data: data.map(d => d.realBalance),
        borderColor: '#f59e0b', // amber-500
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderDash: [5, 5],
        borderWidth: 1.5,
        tension: 0.3,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 5
      },
      {
        type: 'line' as const,
        label: 'Total Contributions',
        data: data.map(d => d.totalContributions),
        borderColor: '#3b82f6', // blue-500
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderWidth: 2,
        tension: 0.3,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 5
      },
      {
        type: 'line' as const,
        label: 'Total Value (Future Value)',
        data: data.map(d => d.balance),
        borderColor: '#10b981', // emerald-500
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderWidth: 2,
        tension: 0.3,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 5
      }
    ]
  };
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
          text: 'Amount'
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
      <div class="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-400">
        <i class="pi pi-chart-line text-xl" />
      </div>
      <div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">
          Compound Interest
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Project your investment growth over time
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <!-- Input Form (1 Column) -->
      <div class="bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 rounded-xl p-5 lg:col-span-1 space-y-5 flex flex-col">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Initial Principal:</label>
          <AmountInput
            v-model="principal"
            :show-currency="true"
            placeholder="0.00"
          />
        </div>
        
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Contribution:</label>
              <div class="relative flex items-center group">
                <span class="absolute left-2 text-[10px] text-gray-400 pointer-events-none group-focus-within:text-primary-500">$</span>
                <input 
                  v-model.number="monthlyContribution" 
                  type="number" 
                  min="0"
                  step="10"
                  class="pl-5 pr-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all" 
                  :style="{ width: (String(monthlyContribution).length + 7) + 'ch' }"
                />
              </div>
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
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Return:</label>
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
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Time to Grow:</label>
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
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
          <!-- Future Value -->
          <div class="card p-4">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Future Value
            </p>
            <p
              class="text-xl font-bold text-gray-900 dark:text-white"
              :class="{ 'privacy-blur': settingsStore.privacyMode }"
            >
              {{ formatCurrency(futureValue) }}
            </p>
          </div>
          <!-- Real Value -->
          <div class="card p-4">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Real Value
            </p>
            <p
              class="text-xl font-bold text-amber-600 dark:text-amber-500"
              :class="{ 'privacy-blur': settingsStore.privacyMode }"
            >
              {{ formatCurrency(realValue) }}
            </p>
          </div>
          <!-- Contributions -->
          <div class="card p-4">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Contributions
            </p>
            <p
              class="text-xl font-bold text-blue-600 dark:text-blue-500"
              :class="{ 'privacy-blur': settingsStore.privacyMode }"
            >
              {{ formatCurrency(totalContributions) }}
            </p>
          </div>
          <!-- Interest -->
          <div class="card p-4">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Total Interest Earned
            </p>
            <p
              class="text-xl font-bold text-emerald-600 dark:text-emerald-500"
              :class="{ 'privacy-blur': settingsStore.privacyMode }"
            >
              {{ formatCurrency(totalInterest) }}
            </p>
          </div>
          <!-- Return -->
          <div class="card p-4">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Total Return
            </p>
            <p
              class="text-xl font-bold text-emerald-600 dark:text-emerald-500"
              :class="{ 'privacy-blur': settingsStore.privacyMode }"
            >
              +{{ totalReturnPercent.toFixed(1) }}%
            </p>
          </div>
        </div>

        <!-- Chart Section -->
        <div class="card p-6 flex-1 min-h-[400px] flex flex-col relative overflow-hidden">
          <div class="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
            <!-- Custom Legend (Left) -->
            <div class="hidden md:flex flex-wrap gap-4 z-10">
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

            <!-- Title (Centered) -->
            <h3 class="absolute left-1/2 -translate-x-1/2 font-semibold text-gray-700 dark:text-gray-200 text-sm lg:text-base whitespace-nowrap z-0">
              Investment Growth Over Time
            </h3>
          </div>

          <div class="flex-1 min-h-0">
            <AppChart
              v-if="projectionData.length > 0"
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
