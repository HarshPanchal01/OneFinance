<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue';
import { useFinanceStore } from '@/stores/finance';
import { InvestmentHolding } from '@/types';
import DatePicker from 'primevue/datepicker';
import { useFormatter } from '@/composables/useFormatter';
import AmountInput from '@/components/AmountInput.vue';
import { useSettingsStore } from '@/stores/settings';
import ErrorModal from '@/components/ErrorModal.vue';

const props = defineProps<{
  holding: InvestmentHolding | null;
  type: 'buy' | 'sell' | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved'): void;
}>();

const store = useFinanceStore();
const { formatCurrency } = useFormatter();
const settingsStore = useSettingsStore();

const errorModal = ref<InstanceType<typeof ErrorModal>>();

const cashBalance = computed(() => {
  if (!props.holding) return 0;
  const accountId = props.holding.accountId;
  const account = store.accounts.find(a => a.id === accountId);
  if (!account) return 0;
  
  const accountHoldings = store.investmentHoldings.filter(h => h.accountId === accountId);
  const holdingsValue = accountHoldings.reduce((sum, h) => sum + store.holdingMarketValue(h), 0);
  
  return (account.balance || 0) - holdingsValue;
});

const isSubmitting = ref(false);

const form = reactive({
  date: new Date() as any,
  quantity: null as number | null,
  price: null as number | null,
  fees: 0 as number | null,
  affectCash: true
});

watch(() => props.holding, (newHolding) => {
  if (newHolding) {
    form.price = newHolding.lastPrice;
    form.quantity = null;
    form.fees = 0;
    form.date = new Date();
    form.affectCash = true;
  }
});

async function submit() {
  if (!props.holding || !props.type || !form.quantity || form.price === null) return;
  if (form.quantity <= 0 || form.price < 0 || (form.fees !== null && form.fees < 0)) return;
  
  if (props.type === 'sell' && form.quantity > props.holding.quantity) {
      if (errorModal.value) {
        await errorModal.value.openConfirmation({
          title: 'Invalid Quantity',
          message: 'You cannot sell more shares than you own.',
          confirmText: 'Ok'
        });
      }
      return;
  }

  isSubmitting.value = true;
  try {
    const isoDate = new Date(form.date.getTime() - form.date.getTimezoneOffset() * 60000).toISOString().split('T')[0];
    
    await store.addInvestmentTransaction({
      holdingId: props.holding.id,
      date: isoDate,
      type: props.type,
      quantity: form.quantity,
      price: form.price,
      fees: form.fees || 0
    });

    if (!form.affectCash) {
      let offsetAmount = 0;
      if (props.type === 'buy') {
        offsetAmount = (form.quantity * form.price) + (form.fees || 0); // Need to add cash back
      } else if (props.type === 'sell') {
        offsetAmount = -((form.quantity * form.price) - (form.fees || 0)); // Need to remove cash added
      }
      if (offsetAmount !== 0) {
        await window.electronAPI.adjustAccountCash(props.holding.accountId, offsetAmount, "Historical Transaction Adjustment");
        await store.fetchAccounts();
      }
    }

    emit('saved');
  } catch (error) {
    console.error(`Error logging ${props.type}:`, error);
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
          <h3 class="text-xl font-bold text-gray-900 dark:text-white capitalize">
            {{ type }} {{ holding?.symbol }}
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Log a new {{ type }} transaction for this asset.
          </p>
        </div>

        <div class="p-6 overflow-y-auto">
          <div class="space-y-4">
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
              <p
                v-if="type === 'sell'"
                class="text-sm text-gray-500 mt-1 italic"
              >
                Max available: {{ holding?.quantity }}
              </p>
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

            <div class="flex items-center space-x-2 mt-2">
              <input
                id="affectCash"
                v-model="form.affectCash"
                type="checkbox"
                class="w-4 h-4 text-primary-500 bg-white border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <label
                for="affectCash"
                class="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
              >
                Affect account cash balance
              </label>
            </div>

            <!-- Summary -->
            <div
              v-if="form.affectCash"
              class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg mt-4 border border-gray-100 dark:border-gray-600"
            >
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
                <span
                  class="font-bold"
                  :class="type === 'buy' ? 'text-expense' : 'text-income'"
                >
                  <span v-if="type==='buy'">-</span><span v-else>+</span>
                  <span :class="{ 'privacy-blur': settingsStore.privacyMode }">{{ formatCurrency((((form.quantity || 0) * (form.price || 0)) + (type === 'buy' ? (form.fees || 0) : -(form.fees || 0)))) }}</span>
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
            class="px-6 py-2 bg-primary-500 dark:bg-primary-900/40 text-white dark:text-primary-300 hover:bg-primary-600 dark:hover:bg-primary-900/60 disabled:opacity-50 disabled:cursor-not-allowed font-bold rounded-lg transition-colors flex items-center capitalize"
            :disabled="!form.quantity || form.quantity <= 0 || form.price === null || form.price < 0 || (form.fees !== null && form.fees < 0) || isSubmitting"
            @click="submit"
          >
            <i
              v-if="isSubmitting"
              class="pi pi-spinner animate-spin mr-2"
            />
            Confirm {{ type }}
          </button>
        </div>
      </div>
    </div>
    <ErrorModal ref="errorModal" />
  </Teleport>
</template>
