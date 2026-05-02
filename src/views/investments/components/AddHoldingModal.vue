<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue';
import { useFinanceStore } from '@/stores/finance';
import DatePicker from 'primevue/datepicker';
import { useFormatter } from '@/composables/useFormatter';
import AmountInput from '@/components/AmountInput.vue';
import { useSettingsStore } from '@/stores/settings';

const props = defineProps<{
  accountId: number | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'added'): void;
}>();

const store = useFinanceStore();
const { formatCurrency } = useFormatter();
const settingsStore = useSettingsStore();

const cashBalance = computed(() => {
  if (!props.accountId) return 0;
  const account = store.accounts.find(a => a.id === props.accountId);
  if (!account) return 0;
  
  const accountHoldings = store.investmentHoldings.filter(h => h.accountId === props.accountId);
  const holdingsValue = accountHoldings.reduce((sum, h) => sum + (h.quantity * (h.lastPrice || 0)), 0);
  
  return (account.balance || 0) - holdingsValue;
});

const searchResults = ref<any[]>([]);
const isSearching = ref(false);
const searchQuery = ref('');
const isSubmitting = ref(false);

const form = reactive({
  symbol: '',
  name: '',
  quantity: null as number | null,
  date: new Date() as any,
  price: null as number | null,
  fees: 0 as number | null,
});

let searchTimeout: any = null;
watch(searchQuery, (newQuery) => {
  if (searchTimeout) window.clearTimeout(searchTimeout);
  
  if (newQuery === form.symbol || newQuery.length < 2) {
    searchResults.value = [];
    return;
  }
  
  searchTimeout = window.setTimeout(async () => {
    const queryForThisSearch = newQuery;
    isSearching.value = true;
    try {
      const results = await window.electronAPI.searchSymbols(queryForThisSearch);
      // Only update if the user hasn't typed something else or already selected this symbol
      if (searchQuery.value === queryForThisSearch && queryForThisSearch !== form.symbol) {
        searchResults.value = results;
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      if (searchQuery.value === queryForThisSearch) {
        isSearching.value = false;
      }
    }
  }, 300);
});

async function selectSymbol(result: any) {
  form.symbol = result.symbol;
  form.name = result.name;
  searchQuery.value = result.symbol;
  searchResults.value = [];
  
  try {
    const quote = await window.electronAPI.getQuote(result.symbol);
    if (quote && quote.price) {
      form.price = quote.price;
    }
  } catch (e) {
    console.error("Failed to fetch initial price for symbol", e);
  }
}

async function submit() {
  if (!props.accountId || !form.symbol || !form.quantity || form.price === null) return;
  
  isSubmitting.value = true;
  try {
    const isoDate = new Date(form.date.getTime() - form.date.getTimezoneOffset() * 60000).toISOString().split('T')[0];

    // Create holding with 0 quantity initially, the transaction will update it
    const holding = await store.addInvestmentHolding({
      accountId: props.accountId,
      symbol: form.symbol,
      name: form.name,
      quantity: 0,
      lastPrice: form.price,
      lastUpdated: new Date().toISOString()
    });
    
    if (holding) {
      await store.addInvestmentTransaction({
        holdingId: holding.id,
        date: isoDate,
        type: 'buy',
        quantity: form.quantity,
        price: form.price,
        fees: form.fees || 0
      });
    }

    emit('added');
  } catch (error) {
    console.error("Error adding holding:", error);
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
                  @mousedown.prevent="selectSymbol(result)"
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
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
              <DatePicker 
                v-model="form.date" 
                date-format="yy-mm-dd"
                class="w-full"
                input-class="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantity</label>
              <AmountInput
                v-model="form.quantity"
                :show-currency="false"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price per Share</label>
              <AmountInput
                v-model="form.price"
                :show-currency="true"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fees (Optional)</label>
              <AmountInput
                v-model="form.fees"
                :show-currency="true"
              />
            </div>

            <!-- Summary -->
            <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg mt-4 border border-gray-100 dark:border-gray-600">
              <div class="flex justify-between items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                <div class="flex items-center space-x-1">
                  <span>Total Cash:</span>
                  <span
                    class="font-bold text-gray-900 dark:text-white"
                    :class="{ 'privacy-blur': settingsStore.privacyMode }"
                  >
                    {{ formatCurrency(cashBalance) }}
                  </span>
                </div>
                <span class="font-bold text-expense">
                  - <span :class="{ 'privacy-blur': settingsStore.privacyMode }">{{ formatCurrency((((form.quantity || 0) * (form.price || 0)) + (form.fees || 0))) }}</span>
                </span>
              </div>
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
            class="px-6 py-2 bg-primary-50 dark:bg-primary-900/10 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/20 border border-primary-200 dark:border-primary-800 disabled:opacity-50 font-bold rounded-lg transition-colors flex items-center"
            :disabled="!form.symbol || !form.quantity || form.price === null || isSubmitting"
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
