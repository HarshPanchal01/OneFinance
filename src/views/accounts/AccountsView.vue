<script setup lang="ts">
import { reactive, ref, onMounted, watch, computed } from 'vue';
import { useFinanceStore } from '@/stores/finance';
import { useSettingsStore } from '@/stores/settings';
import { useFormatter } from '@/composables/useFormatter';
import AccountListView from './components/AccountListView.vue';
import { Account, AccountClassification } from '@/types';
import ErrorModal from '@/components/ErrorModal.vue';
import AccountDeleteModal from './components/AccountDeleteModal.vue';
import AmountInput from '@/components/AmountInput.vue';

const props = defineProps<{
  highlightAccountId?: number | null;
}>();

const emit = defineEmits<{
  (e: "request-view-transactions", id: number): void;
}>();

const store = useFinanceStore();
const settingsStore = useSettingsStore();
const { formatCurrency } = useFormatter();

const totalNetWorth = computed(() => {
  return store.accounts.reduce((sum, account) => sum + (account.balance || 0), 0);
});

const accountsTypeArray = store.accountTypes.filter(() => true);
const errorModal = ref<InstanceType<typeof ErrorModal>>();

const openDialog = ref(false);
const showDeleteModal = ref(false);
const accountToDelete = ref<Account | null>(null);
const highlightedId = ref<number | null>(null);
const expandedSections = computed({
  get: () => store.expandedAccountSections,
  set: (val) => { store.expandedAccountSections = val; }
});

const isEdit = ref(false);
let accountEditId = 0;
const hasExistingInterest = ref(false);
const existingNextInterestDate = ref<string | null>(null);

const state = reactive({
  accountArray: store.accounts,
  accountTypeArray: accountsTypeArray
});

function getTodayStr(): string {
  const today = new Date();
  return today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');
}

function computeNextInterestDate(startDateStr: string, compounding: string): string {
  const [year, month, day] = startDateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const monthsMap: Record<string, number> = {
    monthly: 1,
    quarterly: 3,
    'semi-annually': 6,
    annually: 12,
  };
  const monthsToAdd = monthsMap[compounding] ?? 1;
  const targetMonth = date.getMonth() + monthsToAdd;
  date.setMonth(targetMonth);
  if (date.getMonth() !== targetMonth % 12) date.setDate(0);
  return date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0');
}

function toggleSection(section: string) {
  const newSet = new Set(expandedSections.value);
  if (newSet.has(section)) {
    newSet.delete(section);
  } else {
    newSet.add(section);
  }
  expandedSections.value = newSet;
}

function highlightAccount(id?: number | null) {
  if (id) {
    highlightedId.value = id;
    
    // Find the account and its classification to expand the section
    const account = store.accounts.find(a => a.id === id);
    if (account) {
      const typeObj = store.accountTypes.find(t => t.id === account.accountTypeId);
      const classification = typeObj?.classification || 'liquid';
      
      const newSet = new Set(expandedSections.value);
      newSet.add(classification);
      expandedSections.value = newSet;
    }

    // Clear highlight after animation
    window.setTimeout(() => {
      highlightedId.value = null;
    }, 2000);
  }
}

onMounted(async () => {
  await store.fetchAccounts();
  await store.fetchAccountTypes();
  state.accountArray = store.accounts;
  highlightAccount(props.highlightAccountId);
});

watch(() => props.highlightAccountId, (newId) => {
  highlightAccount(newId);
});

const form = reactive({
  accountName: '',
  institutionName: '',
  startingBalance: 0 as number | null,
  classification: 'liquid' as AccountClassification,
  accountType: null as number | null,
  isDefault: false,
  interestRate: null as number | null,
  interestCompounding: 'monthly' as string,
  interestStartDate: getTodayStr(),
});

const filteredAccountTypes = computed(() => {
  return state.accountTypeArray.filter(t => t.classification === form.classification);
});


function closeDialog() {
  openDialog.value = false;
  isEdit.value = false;
  accountEditId = 0;
  hasExistingInterest.value = false;
  existingNextInterestDate.value = null;
  Object.assign(form, {
    accountName: '',
    institutionName: '',
    startingBalance: 0 as number | null,
    classification: 'liquid',
    accountType: null,
    isDefault: false,
    interestRate: null,
    interestCompounding: 'monthly',
    interestStartDate: getTodayStr(),
  });
}

async function submitForm() {
  const isLiability = form.classification === 'liability';
  const amount = form.startingBalance ?? 0;
  const processedBalance = isLiability ? -Math.abs(amount) : Math.abs(amount);

  const hasInterest = form.classification === 'liquid' && !!form.interestRate && form.interestRate > 0;
  let interestRate: number | null = null;
  let interestCompounding: string | null = null;
  let nextInterestDate: string | null = null;

  if (hasInterest) {
    interestRate = form.interestRate! / 100;
    interestCompounding = form.interestCompounding;
    if (isEdit.value && hasExistingInterest.value) {
      nextInterestDate = existingNextInterestDate.value;
    } else {
      const startDate = form.interestStartDate || getTodayStr();
      nextInterestDate = computeNextInterestDate(startDate, form.interestCompounding);
    }
  }

  if(!isEdit.value){
    await store.addAccount({
      id: 0,
      accountName: form.accountName,
      institutionName: form.institutionName,
      startingBalance: processedBalance,
      accountTypeId: form.accountType,
      isDefault: form.isDefault,
      interestRate,
      interestCompounding,
      nextInterestDate,
    } as Account);
  }
  else{
    await store.editAccount({
      id: accountEditId,
      accountName: form.accountName,
      institutionName: form.institutionName,
      startingBalance: processedBalance,
      accountTypeId: form.accountType,
      isDefault: form.isDefault,
      interestRate,
      interestCompounding,
      nextInterestDate,
    } as Account);
  }

  closeDialog();

  await store.fetchAccounts();
  await store.fetchTransactions(store.currentLedgerMonth, store.selectedYear ?? undefined);
  store.fetchPeriodSummarySync();
  state.accountArray = store.accounts.filter(() => true);
}

function editAccount(account: Account) {
  const accountTypeObj = state.accountTypeArray.find(t => t.id === account.accountTypeId);

  openDialog.value = true;
  form.accountName = account.accountName;
  form.institutionName = account.institutionName ?? "";
  form.startingBalance = Math.abs(account.startingBalance);
  form.classification = accountTypeObj?.classification || 'liquid';
  form.accountType = account.accountTypeId;
  form.isDefault = Boolean(account.isDefault);
  isEdit.value = true;
  accountEditId = account.id;

  hasExistingInterest.value = !!(account.interestRate && account.interestRate > 0);
  existingNextInterestDate.value = account.nextInterestDate ?? null;
  form.interestRate = account.interestRate ? Math.round(account.interestRate * 10000) / 100 : null;
  form.interestCompounding = account.interestCompounding ?? 'monthly';
  form.interestStartDate = getTodayStr();
}

function viewTransactions(account: Account) {
  emit("request-view-transactions", account.id);
}

async function deleteAccount(account: Account) {

  if (store.accounts.length <= 1) {
    await errorModal.value?.openConfirmation({
      title: 'Cannot Delete Account',
      message: 'At least one account must exist in the system.',
      confirmText: 'Okay'
    });
    return;
  }
  
  accountToDelete.value = account;
  showDeleteModal.value = true;
}

async function handleDeleteConfirm(strategy: 'transfer' | 'delete', transferToAccountId?: number) {
  if (!accountToDelete.value) return;

  await store.removeAccount(accountToDelete.value.id, strategy, transferToAccountId);
  await store.fetchAccounts();
  state.accountArray = store.accounts.filter(() => true);
  
  showDeleteModal.value = false;
  accountToDelete.value = null;
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <header class="flex items-center justify-between mb-6 shrink-0">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          Accounts
        </h1>
        <p class="text-gray-500 dark:text-gray-400 mt-1">
          Manage your accounts and track net worth.
        </p>
      </div>
      <div class="flex items-center space-x-6">
        <div class="text-right">
          <span
            class="text-2xl font-bold text-gray-900 dark:text-white"
            :class="{ 'privacy-blur': settingsStore.privacyMode }"
          >
            {{ formatCurrency(totalNetWorth) }}
          </span>
          <p class="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
            Total Net Worth
          </p>
        </div>
        <div class="flex items-center space-x-3">
          <button
            class="inline-flex items-center px-4 py-2 bg-primary-500 dark:bg-primary-900/40 text-white dark:text-primary-300 hover:bg-primary-600 dark:hover:bg-primary-900/60 font-medium rounded-lg transition-colors"
            @click="openDialog = true"
          >
            <i class="pi pi-plus mr-2" />
            New Account
          </button>
        </div>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto min-h-0 space-y-6 pb-6">
      <AccountListView
        :account-array="state.accountArray"
        :highlighted-id="highlightedId"
        :expanded-sections="expandedSections"
        @edit="editAccount"
        @delete="deleteAccount"
        @view-transactions="viewTransactions"
        @toggle-section="toggleSection"
      />

      <div
        v-if="openDialog"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      >
        <div class="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-md sm:mx-auto shadow-lg flex flex-col max-h-[90vh]">
          <h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-white shrink-0">
            {{ isEdit ? 'Edit Account' : 'Add New Account' }}
          </h2>

          <form
            class="space-y-4 overflow-y-auto min-h-0 pr-1"
            @submit.prevent="submitForm"
          >
            <!-- Classification Toggle -->
            <div
              class="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"
              :class="{ 'opacity-75 cursor-not-allowed': isEdit }"
            >
              <button
                type="button"
                :disabled="isEdit"
                :class="[
                  'flex-1 py-2 text-sm font-medium transition-colors',
                  form.classification === 'liquid'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
                  !isEdit && form.classification !== 'liquid' ? 'hover:bg-gray-100 dark:hover:bg-gray-600' : ''
                ]"
                @click="form.classification = 'liquid'; form.accountType = null;"
              >
                Liquid
              </button>
              <button
                type="button"
                :disabled="isEdit"
                :class="[
                  'flex-1 py-2 text-sm font-medium transition-colors',
                  form.classification === 'liability'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
                  !isEdit && form.classification !== 'liability' ? 'hover:bg-gray-100 dark:hover:bg-gray-600' : ''
                ]"
                @click="form.classification = 'liability'; form.accountType = null;"
              >
                Liability
              </button>
              <button
                type="button"
                :disabled="isEdit"
                :class="[
                  'flex-1 py-2 text-sm font-medium transition-colors',
                  form.classification === 'asset'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
                  !isEdit && form.classification !== 'asset' ? 'hover:bg-gray-100 dark:hover:bg-gray-600' : ''
                ]"
                @click="form.classification = 'asset'; form.accountType = null; form.isDefault = false;"
              >
                Asset
              </button>
              <button
                type="button"
                :disabled="isEdit"
                :class="[
                  'flex-1 py-2 text-sm font-medium transition-colors',
                  form.classification === 'investment'
                    ? 'bg-amber-500 text-white'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
                  !isEdit && form.classification !== 'investment' ? 'hover:bg-gray-100 dark:hover:bg-gray-600' : ''
                ]"
                @click="form.classification = 'investment'; form.accountType = null; form.isDefault = false;"
              >
                Investment
              </button>
            </div>

            <div>
              <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Account Name</label>
              <input
                v-model="form.accountName"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                required
                placeholder="Type account name"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Institution</label>
              <input
                v-model="form.institutionName"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="Type institution name"
              />
            </div>
          
            <!-- Amount -->
            <div>
              <label
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Starting Balance
              </label>
              <AmountInput
                v-model="form.startingBalance"
                show-currency
                placeholder="0.00"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Account Type</label>
              <select
                v-model="form.accountType"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              >
                <option
                  :value="null"
                  disabled
                  hidden
                >
                  Select an account type
                </option>
                <option
                  v-for="type in filteredAccountTypes"
                  :key="type.id"
                  :value="type.id"
                >
                  {{ type.type }}
                </option>
              </select>
            </div>
            <div
              v-if="form.classification !== 'asset' && form.classification !== 'investment'"
              class="flex items-center space-x-2"
            >
              <input
                v-model="form.isDefault"
                type="checkbox"
                class="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800"
              />
              <label
                for="isDefault"
                class="text-sm font-medium text-gray-700 dark:text-gray-300"
              >Set as Default</label>
            </div>

            <!-- Interest Settings (liquid accounts only) -->
            <div
              v-if="form.classification === 'liquid'"
              class="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3"
            >
              <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Interest Settings
              </h3>
              <div class="flex gap-3">
                <div class="flex-1">
                  <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Annual Rate (%)</label>
                  <input
                    v-model.number="form.interestRate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder="e.g. 4.5"
                  />
                </div>
                <div class="flex-1">
                  <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Compounding</label>
                  <select
                    v-model="form.interestCompounding"
                    :disabled="!form.interestRate"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  >
                    <option value="monthly">
                      Monthly
                    </option>
                    <option value="quarterly">
                      Quarterly
                    </option>
                    <option value="semi-annually">
                      Semi-Annually
                    </option>
                    <option value="annually">
                      Annually
                    </option>
                  </select>
                </div>
              </div>

              <!-- Start date: only when setting up interest for the first time -->
              <div v-if="form.interestRate && form.interestRate > 0 && !(isEdit && hasExistingInterest)">
                <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Interest Start Date</label>
                <input
                  v-model="form.interestStartDate"
                  type="date"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Set to an earlier date to backfill historical interest transactions.
                </p>
              </div>

              <!-- Show next scheduled date when editing existing interest -->
              <p
                v-else-if="isEdit && hasExistingInterest && form.interestRate && form.interestRate > 0"
                class="text-xs text-gray-400 dark:text-gray-500"
              >
                Next interest date: {{ existingNextInterestDate ?? '—' }}
              </p>
            </div>

            <!-- Footer -->
            <div class="flex justify-end items-center pt-4 border-t border-gray-200 dark:border-gray-700 shrink-0 space-x-3 mt-4">
              <button
                type="button"
                class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                @click="closeDialog"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="!form.accountType || !form.accountName.trim()"
                class="px-4 py-2 bg-primary-500 dark:bg-primary-900/40 text-white dark:text-primary-300 hover:bg-primary-600 dark:hover:bg-primary-900/60 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    <AccountDeleteModal
      :visible="showDeleteModal"
      :account="accountToDelete"
      @close="showDeleteModal = false"
      @confirm="handleDeleteConfirm"
    />
    <ErrorModal ref="errorModal" />
  </div>
</template>
