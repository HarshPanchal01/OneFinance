<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { InvestmentHolding } from '@/types';
import { useFormatter } from '@/composables/useFormatter';
import { useSettingsStore } from '@/stores/settings';
import { useFinanceStore } from '@/stores/finance';

const props = defineProps<{
  holding: InvestmentHolding | null;
  accountId?: number | null;
  isCash?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const { formatDate, formatCurrency } = useFormatter();
const settingsStore = useSettingsStore();
const store = useFinanceStore();

const accountName = computed(() => {
  if (props.accountId) {
    const acc = store.accounts.find(a => a.id === props.accountId);
    return acc ? acc.accountName : '';
  }
  return '';
});

const transactions = ref<any[]>([]);
const isLoading = ref(true);
const typeFilter = ref('all');
const sortOrder = ref('date-desc');

// Custom dropdown states
const showTypePicker = ref(false);
const typePickerRef = ref<HTMLElement | null>(null);

const showAssetPicker = ref(false);
const assetPickerRef = ref<HTMLElement | null>(null);
const assetSearch = ref('');
const selectedAssets = ref<string[]>([]);





function selectType(type: string) {
  typeFilter.value = type;
  showTypePicker.value = false;
}



const uniqueAssets = computed(() => {
  const assets = new Set<string>();
  transactions.value.forEach(tx => {
    // Only include entries that are part of a trade (have holdingSymbol) 
    // and aren't generic cash movements or adjustments
    if (tx.recordType === 'trade' && (tx.asset || tx.holdingSymbol)) {
      assets.add(tx.asset || tx.holdingSymbol);
    }
  });
  return Array.from(assets).sort();
});


const tempSelectedAssets = ref<string[]>([]);

function togglePicker(picker: 'type' | 'asset' | 'date' | 'amount') {
  if (picker === 'type') {
    showTypePicker.value = !showTypePicker.value;
    showAssetPicker.value = false;
    showDatePicker.value = false;
    showAmountPicker.value = false;
  } else if (picker === 'asset') {
    showAssetPicker.value = !showAssetPicker.value;
    showTypePicker.value = false;
    showDatePicker.value = false;
    showAmountPicker.value = false;
    if (showAssetPicker.value) {
      assetSearch.value = '';
      tempSelectedAssets.value = [...selectedAssets.value];
    }
  } else if (picker === 'date') {
    showDatePicker.value = !showDatePicker.value;
    showAssetPicker.value = false;
    showTypePicker.value = false;
    showAmountPicker.value = false;
  } else if (picker === 'amount') {
    showAmountPicker.value = !showAmountPicker.value;
    showAssetPicker.value = false;
    showTypePicker.value = false;
    showDatePicker.value = false;
  }
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as Node;
  if (typePickerRef.value && !typePickerRef.value.contains(target)) showTypePicker.value = false;
  if (assetPickerRef.value && !assetPickerRef.value.contains(target)) showAssetPicker.value = false;
  if (datePickerRef.value && !datePickerRef.value.contains(target)) showDatePicker.value = false;
  if (amountPickerRef.value && !amountPickerRef.value.contains(target)) showAmountPicker.value = false;
}

function isAssetSelected(asset: string): boolean {
  return tempSelectedAssets.value.includes(asset);
}

function toggleAsset(asset: string) {
  if (tempSelectedAssets.value.includes(asset)) {
    tempSelectedAssets.value = tempSelectedAssets.value.filter(a => a !== asset);
  } else {
    tempSelectedAssets.value.push(asset);
  }
}

function applyAssetFilter() {
  selectedAssets.value = [...tempSelectedAssets.value];
  showAssetPicker.value = false;
}

const showDatePicker = ref(false);
const datePickerRef = ref<HTMLElement | null>(null);

const showAmountPicker = ref(false);
const amountPickerRef = ref<HTMLElement | null>(null);

function selectSort(order: string) {
    sortOrder.value = order;
    showDatePicker.value = false;
    showAmountPicker.value = false;
}

function clearFilters() {
    typeFilter.value = 'all';
    selectedAssets.value = [];
    tempSelectedAssets.value = [];
    sortOrder.value = 'date-desc';
}

const isFiltered = computed(() => {
    return typeFilter.value !== 'all' || selectedAssets.value.length > 0 || sortOrder.value !== 'date-desc';
});

const pickerAssets = computed(() => {
  const term = assetSearch.value.toLowerCase();
  if (!term) return uniqueAssets.value;
  return uniqueAssets.value.filter(a => a.toLowerCase().includes(term));
});

const filteredTransactions = computed(() => {
  let result = [...transactions.value];
  
  if (typeFilter.value !== 'all') {
    result = result.filter(tx => {
      const typeStr = tx.recordType === 'adjustment' ? 'adjustment' : tx.type;
      return typeStr === typeFilter.value;
    });
  }

  if (selectedAssets.value.length > 0) {
    result = result.filter(tx => {
      const assetStr = tx.asset || tx.holdingSymbol || '';
      return selectedAssets.value.includes(assetStr);
    });
  }

  result.sort((a, b) => {
    if (sortOrder.value === 'date-desc') {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    } else if (sortOrder.value === 'date-asc') {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    } else if (sortOrder.value === 'amount-desc') {
      return Math.abs(b.amount) - Math.abs(a.amount);
    } else if (sortOrder.value === 'amount-asc') {
      return Math.abs(a.amount) - Math.abs(b.amount);
    }
    return 0;
  });

  return result;
});

onMounted(async () => {
  window.addEventListener('click', handleClickOutside);
  try {
    if (props.holding) {
      transactions.value = await window.electronAPI.getInvestmentTransactions(props.holding.id);
    } else if (props.isCash && props.accountId) {
      transactions.value = await window.electronAPI.getCombinedCashHistory(props.accountId);
    } else if (props.accountId) {
      transactions.value = await window.electronAPI.getCombinedInvestmentHistory(props.accountId);
    } else {
      transactions.value = await window.electronAPI.getAllCombinedInvestmentHistory();
    }
  } catch (e) {
    console.error("Failed to fetch investment transactions", e);
  } finally {
    isLoading.value = false;
  }
});

onUnmounted(() => {
  window.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        class="absolute inset-0 bg-black/50"
        @click="emit('close')"
      />
      <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
        <div class="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <div>
            <h3 class="text-xl font-bold text-gray-900 dark:text-white">
              Activity History
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              <template v-if="holding">
                Transaction ledger for {{ holding.symbol }}
              </template>
              <template v-else-if="isCash">
                Cash adjustments and transfers
              </template>
              <template v-else-if="accountId">
                All trades for {{ accountName }}
              </template>
              <template v-else>
                All trades across all investment accounts
              </template>
            </p>
          </div>
          <div class="flex items-center space-x-3">
            <button
              v-if="isFiltered"
              class="text-sm font-medium text-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              @click="clearFilters"
            >
              Clear Filters
            </button>
            <button
              class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              @click="emit('close')"
            >
              <i class="pi pi-times" />
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-0 min-h-[450px]">
          <div
            v-if="isLoading"
            class="p-8 flex justify-center"
          >
            <i class="pi pi-spinner animate-spin text-2xl text-primary-500" />
          </div>
          

          <!-- Cash Mode Table -->
          <table
            v-else-if="isCash"
            class="w-full text-sm text-left"
          >
            <thead class="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-900 sticky top-0 z-10 shadow-sm">
              <tr>
                <th
                  class="px-6 py-3 font-semibold cursor-pointer hover:text-primary-500 transition-colors group relative"
                  :class="{ 'text-primary-500': sortOrder === 'date-asc' }"
                  @click.stop="togglePicker('date')"
                >
                  <div class="flex items-center space-x-1">
                    <span>Date</span>
                    <i
                      class="pi pi-chevron-down text-[10px] text-gray-300 group-hover:text-primary-500 transition-colors"
                      :class="{ 'text-primary-500': sortOrder === 'date-asc' }"
                    />
                  </div>
                  <div
                    v-if="showDatePicker"
                    ref="datePickerRef"
                    class="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 flex flex-col overflow-hidden p-1 space-y-0.5 font-normal normal-case cursor-default"
                    @click.stop
                  >
                    <button
                      class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      :class="sortOrder === 'date-desc' ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 font-medium' : 'text-gray-700 dark:text-gray-200'"
                      @click="selectSort('date-desc')"
                    >
                      Newest First
                    </button>
                    <button
                      class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      :class="sortOrder === 'date-asc' ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 font-medium' : 'text-gray-700 dark:text-gray-200'"
                      @click="selectSort('date-asc')"
                    >
                      Oldest First
                    </button>
                  </div>
                </th>
                <th
                  class="px-6 py-3 font-semibold cursor-pointer hover:text-primary-500 transition-colors group relative"
                  :class="{ 'text-primary-500': typeFilter !== 'all' }"
                  @click.stop="togglePicker('type')"
                >
                  <div class="flex items-center space-x-1">
                    <span>Type</span>
                    <i
                      class="pi pi-chevron-down text-[10px] text-gray-300 group-hover:text-primary-500 transition-colors"
                      :class="{ 'text-primary-500': typeFilter !== 'all' }"
                    />
                  </div>
                  <div
                    v-if="showTypePicker"
                    ref="typePickerRef"
                    class="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 flex flex-col overflow-hidden p-1 space-y-0.5 font-normal normal-case cursor-default"
                    @click.stop
                  >
                    <button
                      class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      :class="typeFilter === 'all' ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 font-medium' : 'text-gray-700 dark:text-gray-200'"
                      @click="selectType('all')"
                    >
                      All Types
                    </button>
                    <button
                      class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      :class="typeFilter === 'buy' ? 'bg-income/10 text-income font-medium' : 'text-gray-700 dark:text-gray-200'"
                      @click="selectType('buy')"
                    >
                      Buy
                    </button>
                    <button
                      class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      :class="typeFilter === 'sell' ? 'bg-expense/10 text-expense font-medium' : 'text-gray-700 dark:text-gray-200'"
                      @click="selectType('sell')"
                    >
                      Sell
                    </button>
                    <button
                      class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      :class="typeFilter === 'transfer' ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 font-medium' : 'text-gray-700 dark:text-gray-200'"
                      @click="selectType('transfer')"
                    >
                      Transfer
                    </button>
                    <button
                      class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      :class="typeFilter === 'adjustment' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 font-medium' : 'text-gray-700 dark:text-gray-200'"
                      @click="selectType('adjustment')"
                    >
                      Adjustment
                    </button>
                  </div>
                </th>
                <th class="px-6 py-3 font-semibold">
                  Description
                </th>
                <th
                  class="px-6 py-3 font-semibold text-right cursor-pointer hover:text-primary-500 transition-colors group relative"
                  :class="{ 'text-primary-500': sortOrder.startsWith('amount') }"
                  @click.stop="togglePicker('amount')"
                >
                  <div class="flex items-center justify-end space-x-1">
                    <span>Amount</span>
                    <i
                      class="pi pi-chevron-down text-[10px] text-gray-300 group-hover:text-primary-500 transition-colors"
                      :class="{ 'text-primary-500': sortOrder.startsWith('amount') }"
                    />
                  </div>
                  <div
                    v-if="showAmountPicker"
                    ref="amountPickerRef"
                    class="absolute top-full right-0 mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 flex flex-col overflow-hidden p-1 space-y-0.5 font-normal normal-case cursor-default text-left"
                    @click.stop
                  >
                    <button
                      class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      :class="sortOrder === 'amount-desc' ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 font-medium' : 'text-gray-700 dark:text-gray-200'"
                      @click="selectSort('amount-desc')"
                    >
                      Highest Amount
                    </button>
                    <button
                      class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      :class="sortOrder === 'amount-asc' ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 font-medium' : 'text-gray-700 dark:text-gray-200'"
                      @click="selectSort('amount-asc')"
                    >
                      Lowest Amount
                    </button>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-if="filteredTransactions.length === 0">
                <td
                  colspan="4"
                  class="px-6 py-8 text-center text-gray-500 dark:text-gray-400 italic"
                >
                  No records found.
                </td>
              </tr>
              <tr
                v-for="tx in filteredTransactions"
                :key="tx.id"
                class="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                <td class="px-6 py-4 text-gray-900 dark:text-white whitespace-nowrap">
                  {{ formatDate(tx.date) }}
                </td>
                <td class="px-6 py-4">
                  <span
                    :class="[
                      'px-2 py-1 text-[10px] font-bold uppercase rounded-full',
                      tx.type === 'transfer' ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' :
                      tx.recordType === 'adjustment' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                      'bg-income-light text-income dark:bg-income/20'
                    ]"
                  >
                    {{ tx.recordType === 'adjustment' ? 'adjustment' : tx.type }}
                  </span>
                </td>
                <td class="px-6 py-4 text-gray-700 dark:text-gray-300">
                  <p class="font-bold">
                    {{ tx.title }}
                  </p>
                  <p
                    v-if="tx.notes"
                    class="text-xs italic"
                  >
                    {{ tx.notes }}
                  </p>
                </td>
                <td
                  class="px-6 py-4 text-right font-bold whitespace-nowrap"
                  :class="[
                    tx.recordType === 'trade' ? 'text-gray-900 dark:text-white' : 
                    (tx.amount < 0 ? 'text-expense' : 'text-income')
                  ]"
                >
                  <template v-if="tx.recordType !== 'trade'">
                    <span v-if="tx.amount < 0">-</span>
                    <span v-else>+</span>
                  </template>
                  <span :class="{ 'privacy-blur': settingsStore.privacyMode }">{{ formatCurrency(Math.abs(tx.amount)) }}</span>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Trades Mode Table (Default) -->
          <table
            v-else
            class="w-full text-sm text-left"
          >
            <thead class="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-900 sticky top-0 z-10 shadow-sm">
              <tr>
                <th
                  class="px-4 py-3 font-semibold cursor-pointer hover:text-primary-500 transition-colors group relative"
                  :class="{ 'text-primary-500': sortOrder === 'date-asc' }"
                  @click.stop="togglePicker('date')"
                >
                  <div class="flex items-center space-x-1">
                    <span>Date</span>
                    <i
                      class="pi pi-chevron-down text-[10px] text-gray-300 group-hover:text-primary-500 transition-colors"
                      :class="{ 'text-primary-500': sortOrder === 'date-asc' }"
                    />
                  </div>
                  <div
                    v-if="showDatePicker"
                    ref="datePickerRef"
                    class="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 flex flex-col overflow-hidden p-1 space-y-0.5 font-normal normal-case cursor-default"
                    @click.stop
                  >
                    <button
                      class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      :class="sortOrder === 'date-desc' ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 font-medium' : 'text-gray-700 dark:text-gray-200'"
                      @click="selectSort('date-desc')"
                    >
                      Newest First
                    </button>
                    <button
                      class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      :class="sortOrder === 'date-asc' ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 font-medium' : 'text-gray-700 dark:text-gray-200'"
                      @click="selectSort('date-asc')"
                    >
                      Oldest First
                    </button>
                  </div>
                </th>
                <th
                  v-if="!holding"
                  class="px-4 py-3 font-semibold cursor-pointer hover:text-primary-500 transition-colors group relative"
                  :class="{ 'text-primary-500': selectedAssets.length > 0 }"
                  @click.stop="togglePicker('asset')"
                >
                  <div class="flex items-center space-x-1">
                    <span>Asset</span>
                    <i
                      class="pi pi-chevron-down text-[10px] text-gray-300 group-hover:text-primary-500 transition-colors"
                      :class="{ 'text-primary-500': selectedAssets.length > 0 }"
                    />
                  </div>
                  <div
                    v-if="showAssetPicker && uniqueAssets.length > 0"
                    ref="assetPickerRef"
                    class="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 flex flex-col overflow-hidden font-normal normal-case cursor-default"
                    @click.stop
                  >
                    <div class="p-2 border-b border-gray-100 dark:border-gray-700">
                      <input
                        v-model="assetSearch"
                        type="text"
                        placeholder="Filter assets..."
                        class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none transition-all"
                        autofocus
                      />
                    </div>
                    <div class="max-h-60 overflow-y-auto p-1 space-y-0.5">
                      <div
                        v-if="pickerAssets.length === 0"
                        class="px-3 py-2 text-sm text-gray-500 text-center"
                      >
                        No assets found
                      </div>
                      <button
                        v-for="asset in pickerAssets"
                        :key="asset"
                        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        @click="toggleAsset(asset)"
                      >
                        <input
                          type="checkbox"
                          :checked="isAssetSelected(asset)"
                          class="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 pointer-events-none dark:bg-gray-700 dark:border-gray-600"
                          tabindex="-1"
                        />
                        <span class="text-gray-900 dark:text-white truncate flex-1">{{ asset }}</span>
                      </button>
                    </div>
                    <div class="p-2 border-t border-gray-100 dark:border-gray-700 flex justify-center">
                      <button
                        class="px-4 py-1.5 bg-primary-500 dark:bg-primary-900/40 text-white dark:text-primary-300 hover:bg-primary-600 dark:hover:bg-primary-900/60 rounded-lg text-xs font-bold transition-colors"
                        @click="applyAssetFilter"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </th>
                <th
                  class="px-4 py-3 font-semibold cursor-pointer hover:text-primary-500 transition-colors group relative"
                  :class="{ 'text-primary-500': typeFilter !== 'all' }"
                  @click.stop="togglePicker('type')"
                >
                  <div class="flex items-center space-x-1">
                    <span>Type</span>
                    <i
                      class="pi pi-chevron-down text-[10px] text-gray-300 group-hover:text-primary-500 transition-colors"
                      :class="{ 'text-primary-500': typeFilter !== 'all' }"
                    />
                  </div>
                  <div
                    v-if="showTypePicker"
                    ref="typePickerRef"
                    class="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 flex flex-col overflow-hidden p-1 space-y-0.5 font-normal normal-case cursor-default"
                    @click.stop
                  >
                    <button
                      class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      :class="typeFilter === 'all' ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 font-medium' : 'text-gray-700 dark:text-gray-200'"
                      @click="selectType('all')"
                    >
                      All Types
                    </button>
                    <button
                      class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      :class="typeFilter === 'buy' ? 'bg-income/10 text-income font-medium' : 'text-gray-700 dark:text-gray-200'"
                      @click="selectType('buy')"
                    >
                      Buy
                    </button>
                    <button
                      class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      :class="typeFilter === 'sell' ? 'bg-expense/10 text-expense font-medium' : 'text-gray-700 dark:text-gray-200'"
                      @click="selectType('sell')"
                    >
                      Sell
                    </button>
                    <button
                      class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      :class="typeFilter === 'transfer' ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 font-medium' : 'text-gray-700 dark:text-gray-200'"
                      @click="selectType('transfer')"
                    >
                      Transfer
                    </button>
                    <button
                      class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      :class="typeFilter === 'adjustment' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 font-medium' : 'text-gray-700 dark:text-gray-200'"
                      @click="selectType('adjustment')"
                    >
                      Adjustment
                    </button>
                  </div>
                </th>
                <th class="px-4 py-3 font-semibold text-right">
                  Quantity
                </th>
                <th class="px-4 py-3 font-semibold text-right">
                  Price
                </th>
                <th class="px-4 py-3 font-semibold text-right">
                  Fees
                </th>
                <th
                  class="px-4 py-3 font-semibold text-right cursor-pointer hover:text-primary-500 transition-colors group relative"
                  :class="{ 'text-primary-500': sortOrder.startsWith('amount') }"
                  @click.stop="togglePicker('amount')"
                >
                  <div class="flex items-center justify-end space-x-1">
                    <span>Total</span>
                    <i
                      class="pi pi-chevron-down text-[10px] text-gray-300 group-hover:text-primary-500 transition-colors"
                      :class="{ 'text-primary-500': sortOrder.startsWith('amount') }"
                    />
                  </div>
                  <div
                    v-if="showAmountPicker"
                    ref="amountPickerRef"
                    class="absolute top-full right-0 mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 flex flex-col overflow-hidden p-1 space-y-0.5 font-normal normal-case cursor-default text-left"
                    @click.stop
                  >
                    <button
                      class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      :class="sortOrder === 'amount-desc' ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 font-medium' : 'text-gray-700 dark:text-gray-200'"
                      @click="selectSort('amount-desc')"
                    >
                      Highest First
                    </button>
                    <button
                      class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      :class="sortOrder === 'amount-asc' ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 font-medium' : 'text-gray-700 dark:text-gray-200'"
                      @click="selectSort('amount-asc')"
                    >
                      Lowest First
                    </button>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-if="filteredTransactions.length === 0">
                <td
                  colspan="7"
                  class="px-4 py-8 text-center text-gray-500 dark:text-gray-400 italic"
                >
                  No records found.
                </td>
              </tr>
              <tr
                v-for="tx in filteredTransactions"
                :key="tx.id"
                class="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                <td class="px-4 py-4 text-gray-900 dark:text-white whitespace-nowrap">
                  {{ formatDate(tx.date) }}
                </td>
                <td
                  v-if="!holding"
                  class="px-4 py-4 font-bold"
                  :class="tx.recordType === 'cash' || tx.recordType === 'adjustment' ? 'text-gray-500 dark:text-gray-400 font-medium' : 'text-primary-600 dark:text-primary-400'"
                >
                  {{ tx.asset || tx.holdingSymbol }}
                </td>
                <td class="px-4 py-4">
                  <span
                    :class="[
                      'px-2 py-1 text-[10px] font-bold uppercase rounded-full',
                      tx.type === 'transfer' ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' :
                      tx.recordType === 'adjustment' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                      tx.recordType === 'cash' ? 'bg-gray-100 text-gray-500 dark:bg-gray-700/50' :
                      (tx.type === 'buy' ? 'bg-income-light text-income dark:bg-income/20' : 'bg-expense-light text-expense dark:bg-expense/20')
                    ]"
                  >
                    {{ tx.recordType === 'adjustment' ? 'adjustment' : tx.type }}
                  </span>
                </td>
                <td class="px-4 py-4 text-right font-medium text-gray-900 dark:text-white">
                  <span :class="{ 'privacy-blur': settingsStore.privacyMode && tx.quantity }">{{ tx.quantity || '---' }}</span>
                </td>
                <td class="px-4 py-4 text-right text-gray-600 dark:text-gray-300">
                  <span :class="{ 'privacy-blur': settingsStore.privacyMode && tx.price }">{{ tx.price ? formatCurrency(tx.price) : '---' }}</span>
                </td>
                <td class="px-4 py-4 text-right text-gray-500 dark:text-gray-400">
                  <span :class="{ 'privacy-blur': settingsStore.privacyMode && tx.fees }">{{ tx.fees ? formatCurrency(tx.fees) : '---' }}</span>
                </td>
                <td
                  class="px-4 py-4 text-right font-bold whitespace-nowrap"
                  :class="[
                    tx.recordType === 'trade' ? 'text-gray-900 dark:text-white' : 
                    (tx.amount < 0 ? 'text-expense' : 'text-income')
                  ]"
                >
                  <template v-if="tx.recordType !== 'trade'">
                    <span v-if="tx.amount < 0">-</span>
                    <span v-else>+</span>
                  </template>
                  <span :class="{ 'privacy-blur': settingsStore.privacyMode }">{{ formatCurrency(Math.abs(tx.amount)) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </Teleport>
</template>