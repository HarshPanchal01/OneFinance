<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { useFinanceStore } from '@/stores/finance';

const props = defineProps<{
  accountId: number | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'added'): void;
}>();

const store = useFinanceStore();

const searchResults = ref<any[]>([]);
const isSearching = ref(false);
const searchQuery = ref('');
const isSubmitting = ref(false);

const form = reactive({
  symbol: '',
  name: '',
  quantity: null as number | null,
});

let searchTimeout: any = null;
watch(searchQuery, (newQuery) => {
  if (searchTimeout) window.clearTimeout(searchTimeout);
  
  if (newQuery.length < 2) {
    searchResults.value = [];
    return;
  }
  
  searchTimeout = window.setTimeout(async () => {
    isSearching.value = true;
    try {
      searchResults.value = await window.electronAPI.searchSymbols(newQuery);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      isSearching.value = false;
    }
  }, 300);
});

function selectSymbol(result: any) {
  form.symbol = result.symbol;
  form.name = result.name;
  searchQuery.value = result.symbol;
  searchResults.value = [];
}

async function submit() {
  if (!props.accountId || !form.symbol) return;
  
  isSubmitting.value = true;
  try {
    // Get latest price for the selected symbol to seed the holding
    const quote = await window.electronAPI.getQuote(form.symbol);
    
    await store.addInvestmentHolding({
      accountId: props.accountId,
      symbol: form.symbol,
      name: form.name || quote.name,
      quantity: form.quantity || 0,
      lastPrice: quote.price,
      lastUpdated: new Date().toISOString()
    });
    
    emit('added');
  } catch (error) {
    console.error("Error adding holding:", error);
    // Fallback if price fetch fails
    await store.addInvestmentHolding({
      accountId: props.accountId,
      symbol: form.symbol,
      name: form.name,
      quantity: form.quantity || 0,
      lastPrice: 0,
      lastUpdated: new Date().toISOString()
    });
    emit('added');
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        class="absolute inset-0 bg-black/50"
        @click="emit('close')"
      />
      <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div class="p-6 border-b border-gray-100 dark:border-gray-700">
          <h3 class="text-xl font-bold text-gray-900 dark:text-white">
            Add Holding
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Search for a stock, ETF, or crypto symbol.
          </p>
        </div>

        <div class="p-6 overflow-y-auto">
          <div class="space-y-4">
            <!-- Symbol Search -->
            <div class="relative">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Symbol Search</label>
              <div class="relative">
                <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="e.g. AAPL, VOO, BTC-USD"
                  class="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                  autocomplete="off"
                />
                <div
                  v-if="isSearching"
                  class="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <i class="pi pi-spinner animate-spin text-primary-500" />
                </div>
              </div>

              <!-- Search Results Dropdown -->
              <div
                v-if="searchResults.length > 0"
                class="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto"
              >
                <button
                  v-for="result in searchResults"
                  :key="result.symbol"
                  class="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between transition-colors border-b last:border-0 border-gray-100 dark:border-gray-700"
                  @click="selectSymbol(result)"
                >
                  <div class="min-w-0">
                    <p class="font-bold text-gray-900 dark:text-white">
                      {{ result.symbol }}
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {{ result.name }}
                    </p>
                  </div>
                  <span class="text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-gray-900 text-gray-500 rounded uppercase font-bold">{{ result.exchange }}</span>
                </button>
              </div>
            </div>

            <div
              v-if="form.symbol"
              class="p-4 bg-primary-50 dark:bg-primary-900/10 rounded-lg border border-primary-100 dark:border-primary-900/30"
            >
              <p class="text-xs text-primary-600 dark:text-primary-400 font-bold uppercase tracking-wider mb-1">
                Selected Asset
              </p>
              <p class="text-lg font-bold text-gray-900 dark:text-white">
                {{ form.symbol }}
              </p>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ form.name }}
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Initial Quantity</label>
              <input
                v-model.number="form.quantity"
                type="number"
                step="any"
                placeholder="0.00"
                class="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
              />
              <p class="text-[10px] text-gray-500 mt-1 italic">
                You can add buy/sell transactions later for better tracking.
              </p>
            </div>
          </div>
        </div>

        <div class="p-6 border-t border-gray-100 dark:border-gray-700 flex justify-end space-x-3">
          <button
            class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            @click="emit('close')"
          >
            Cancel
          </button>
          <button
            class="px-6 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-bold rounded-lg transition-colors flex items-center"
            :disabled="!form.symbol || isSubmitting"
            @click="submit"
          >
            <i
              v-if="isSubmitting"
              class="pi pi-spinner animate-spin mr-2"
            />
            Add Asset
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
