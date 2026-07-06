<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue';
import { useFinanceStore } from '@/stores/finance';
import { useSettingsStore } from '@/stores/settings';
import { InvestmentHolding, InvestmentTransaction, InvestmentDividend } from '@/types';
import DatePicker from 'primevue/datepicker';
import AmountInput from '@/components/AmountInput.vue';
import { useFormatter } from '@/composables/useFormatter';
import { sharesHeldOn } from '@/utils';

const props = defineProps<{
  holding: InvestmentHolding;
  dividend?: InvestmentDividend | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved'): void;
}>();

const store = useFinanceStore();
const settingsStore = useSettingsStore();
const { formatCurrency, formatCurrencyIn, isForeignCurrency } = useFormatter();

const isEditing = computed(() => props.dividend != null);
const isSubmitting = ref(false);
const trades = ref<InvestmentTransaction[]>([]);

const form = reactive({
  date: new Date() as any,
  perShare: null as number | null,
  amount: null as number | null,
});

// Suppress per-share auto-fill until initial hydration finishes, so prefilling
// an existing dividend (and the async trade load moving sharesOnDate off 0)
// doesn't clobber the stored total.
let hydrated = false;

onMounted(async () => {
  try {
    trades.value = await window.electronAPI.getInvestmentTransactions(props.holding.id);
  } catch (e) {
    console.error('Failed to fetch trades for dividend modal', e);
  }
  if (props.dividend) {
    // Parse as local midnight so the DatePicker doesn't shift a day in -UTC zones
    form.date = new Date(props.dividend.date + 'T00:00:00');
    form.perShare = props.dividend.perShare ?? null;
    form.amount = props.dividend.amount;
  }
  await nextTick();
  hydrated = true;
});

const isoDate = computed(() =>
  new Date(form.date.getTime() - form.date.getTimezoneOffset() * 60000).toISOString().split('T')[0]
);

const sharesOnDate = computed(() => sharesHeldOn(trades.value, isoDate.value));

// Per-share entry is a convenience: it fills the total from the shares held on
// the chosen date, but the total stays directly editable (broker statements
// sometimes differ by withholding/rounding). AmountInput commits its model on
// blur/Enter, so watching the model is the "entry finished" hook.
watch([() => form.perShare, sharesOnDate], () => {
  if (!hydrated) return;
  if (form.perShare != null && form.perShare > 0 && sharesOnDate.value > 0) {
    form.amount = Math.round(form.perShare * sharesOnDate.value * 100) / 100;
  }
});

const convertedAmount = computed(() =>
  store.convertToUserCurrency(form.amount || 0, props.holding.currency)
);

async function submit() {
  if (!form.amount || form.amount <= 0) return;
  isSubmitting.value = true;
  try {
    const perShare = form.perShare != null && form.perShare > 0 ? form.perShare : null;
    if (props.dividend) {
      // Keep the stored pay-date rate for an amount-only edit; recapture (pass
      // null) only when the date moved, since the rate is date-specific.
      const dateChanged = isoDate.value !== props.dividend.date;
      await store.editInvestmentDividend(props.dividend.id, {
        holdingId: props.dividend.holdingId,
        date: isoDate.value,
        amount: form.amount,
        perShare,
        currency: props.dividend.currency ?? null,
        fxRate: dateChanged ? null : (props.dividend.fxRate ?? null),
        source: props.dividend.source,
      });
    } else {
      await store.addInvestmentDividend({
        holdingId: props.holding.id,
        date: isoDate.value,
        amount: form.amount,
        perShare,
        source: 'manual',
      });
    }
    emit('saved');
  } catch (e) {
    console.error('Error saving dividend:', e);
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        class="absolute inset-0 bg-black/50"
        @click="emit('close')"
      />
      <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div class="p-6 border-b border-gray-100 dark:border-gray-700">
          <h3 class="text-xl font-bold text-gray-900 dark:text-white">
            {{ isEditing ? 'Edit' : 'Add' }} Dividend — {{ holding.symbol }}
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ isEditing ? 'Update this dividend record.' : 'Record dividend income received for this holding.' }}
          </p>
        </div>

        <div class="p-6 overflow-y-auto">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pay Date</label>
              <DatePicker
                v-model="form.date"
                date-format="yy-mm-dd"
                class="w-full"
                input-class="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
              />
              <p class="text-sm text-gray-500 mt-1 italic">
                You held {{ sharesOnDate }} share{{ sharesOnDate === 1 ? '' : 's' }} on this date.
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Amount per Share (Optional)
                <span
                  v-if="isForeignCurrency(holding.currency)"
                  class="text-[10px] text-gray-400 dark:text-gray-500 font-normal"
                >({{ holding.currency }})</span>
              </label>
              <AmountInput
                v-model="form.perShare"
                :show-currency="true"
                :currency="holding.currency"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Total Received
                <span
                  v-if="isForeignCurrency(holding.currency)"
                  class="text-[10px] text-gray-400 dark:text-gray-500 font-normal"
                >({{ holding.currency }})</span>
              </label>
              <AmountInput
                v-model="form.amount"
                :show-currency="true"
                :currency="holding.currency"
              />
            </div>

            <!-- Summary -->
            <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg mt-4 border border-gray-100 dark:border-gray-600">
              <div class="flex justify-between items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                <span>Added to account cash:</span>
                <div class="flex flex-col items-end">
                  <span class="font-bold text-income">
                    +<span :class="{ 'privacy-blur': settingsStore.privacyMode }">{{ formatCurrency(convertedAmount) }}</span>
                  </span>
                  <span
                    v-if="isForeignCurrency(holding.currency)"
                    class="text-[10px] text-gray-400 dark:text-gray-500"
                    :class="{ 'privacy-blur': settingsStore.privacyMode }"
                  >{{ formatCurrencyIn(form.amount || 0, holding.currency) }} {{ holding.currency }}</span>
                </div>
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
            class="px-6 py-2 bg-primary-500 dark:bg-primary-900/40 text-white dark:text-primary-300 hover:bg-primary-600 dark:hover:bg-primary-900/60 disabled:opacity-50 disabled:cursor-not-allowed font-medium rounded-lg transition-colors flex items-center"
            :disabled="!form.amount || form.amount <= 0 || isSubmitting"
            @click="submit"
          >
            <i
              v-if="isSubmitting"
              class="pi pi-spinner animate-spin mr-2"
            />
            {{ isEditing ? 'Save Changes' : 'Add Dividend' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
