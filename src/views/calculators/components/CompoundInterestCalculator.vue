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
const interestRate = ref<number | null>(7);
const inflationRate = ref<number | null>(2.5);
const years = ref<number | null>(10);

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
  const pmt = monthlyContribution.value || 0;
  const rate = (interestRate.value || 0) / 100;
  const infl = (inflationRate.value || 0) / 100;
  const monthlyRate = rate / 12;
  const yCount = years.value || 0;
  
  // Year 0
  data.push({
    year: 0,
    label: 'Year 0',
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
    }
    
    data.push({
      year: y,
      label: `Year ${y}`,
      totalContributions: totalContrib,
      totalInterest: accumulatedInterest,
      balance: balance,
      realBalance: balance / Math.pow(1 + infl, y)
    });
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

const realFutureValue = computed(() => {
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

const totalReturn = computed(() => {
  const tc = totalContributions.value;
  if (tc === 0) return 0;
  return (totalInterest.value / tc) * 100;
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
        borderColor: 'rgba(245, 158, 11, 0.8)', // amber-500
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderDash: [5, 5],
        borderWidth: 2,
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
        fill: '-1', // Fill down to the contributions line
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
          text: 'Years'
        }
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Amount'
        }
      }
    },
    plugins: {
      tooltip: {
        mode: 'index',
        intersect: false
      },
      legend: {
        position: 'top',
        align: 'end'
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
      <div class="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
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
      <div class="bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 rounded-xl p-5 lg:col-span-1 space-y-5">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Initial Principal</label>
          <AmountInput
            v-model="principal"
            :show-currency="true"
            placeholder="0.00"
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Monthly Contribution</label>
          <AmountInput
            v-model="monthlyContribution"
            :show-currency="true"
            placeholder="0.00"
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Est. Annual Return (%)</label>
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
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Years to Grow</label>
          <input 
            v-model.number="years" 
            type="number" 
            min="1"
            max="100"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none" 
          />
        </div>

        <button 
          class="w-full mt-4 bg-primary-500 hover:bg-primary-600 text-white dark:text-white font-medium py-2 px-4 rounded-lg transition-colors"
          @click="calculate"
        >
          Calculate
        </button>
      </div>

      <!-- Results & Chart (3 Columns) -->
      <div class="lg:col-span-3 flex flex-col gap-4">
        <!-- Metrics Grid -->
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
          <!-- Future Value -->
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
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
          <!-- Real Future Value -->
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
            <p
              class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
              title="Adjusted for inflation"
            >
              Real Value
            </p>
            <p
              class="text-xl font-bold text-amber-600 dark:text-amber-500"
              :class="{ 'privacy-blur': settingsStore.privacyMode }"
            >
              {{ formatCurrency(realFutureValue) }}
            </p>
          </div>
          <!-- Total Contributions -->
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
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
          <!-- Total Interest -->
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Total Interest
            </p>
            <p
              class="text-xl font-bold text-emerald-600 dark:text-emerald-500"
              :class="{ 'privacy-blur': settingsStore.privacyMode }"
            >
              +{{ formatCurrency(totalInterest) }}
            </p>
          </div>
          <!-- Total Return % -->
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Total Return
            </p>
            <p
              class="text-xl font-bold text-primary-600 dark:text-primary-400"
              :class="{ 'privacy-blur': settingsStore.privacyMode }"
            >
              +{{ totalReturn.toFixed(1) }}%
            </p>
          </div>
        </div>

        <!-- Chart -->
        <div class="card flex-1 w-full min-h-[350px] p-4 flex flex-col">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-2 ml-2">
            Investment Growth Over Time
          </h3>
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