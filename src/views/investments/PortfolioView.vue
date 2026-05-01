<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useFinanceStore } from '@/stores/finance';
import { useSettingsStore } from '@/stores/settings';
import { InvestmentHolding } from '@/types';
import AddHoldingModal from './components/AddHoldingModal.vue';
import TransactionHoldingModal from './components/TransactionHoldingModal.vue';
import TradeHistoryModal from './components/TradeHistoryModal.vue';
import AdjustCashModal from './components/AdjustCashModal.vue';
import { useFormatter } from '@/composables/useFormatter';

const store = useFinanceStore();
const settingsStore = useSettingsStore();
const { getCurrencySymbol, formatCurrency } = useFormatter();

const investmentAccounts = computed(() => {
  return store.accounts.filter(account => {
    const type = store.accountTypes.find(t => t.id === account.accountTypeId);
    return type?.classification === 'investment';
  });
});

const totalPortfolioValue = computed(() => {
  return investmentAccounts.value.reduce((sum, account) => sum + (account.balance || 0), 0);
});

const expandedAccounts = ref<Set<number>>(new Set());

function toggleAccount(accountId: number) {
  const newSet = new Set(expandedAccounts.value);
  if (newSet.has(accountId)) {
    newSet.delete(accountId);
  } else {
    newSet.add(accountId);
  }
  expandedAccounts.value = newSet;
}

const selectedAccountId = ref<number | null>(null);
const showAddHoldingModal = ref(false);
const isRefreshing = ref(false);

const showTransactionModal = ref(false);
const selectedHolding = ref<InvestmentHolding | null>(null);
const transactionType = ref<'buy' | 'sell' | null>(null);

const showHistoryModal = ref(false);
const historyHolding = ref<InvestmentHolding | null>(null);
const historyAccountId = ref<number | null>(null);
const historyIsCash = ref(false);

const showAdjustCashModal = ref(false);
const adjustCashAccountId = ref<number | null>(null);
const adjustCashCurrentValue = ref(0);

onMounted(async () => {
  await store.fetchAccounts();
  await store.fetchAccountTypes();
  await store.fetchInvestmentHoldings();
});

async function refreshPrices() {
  isRefreshing.value = true;
  await store.refreshInvestmentPrices();
  await store.fetchAccounts(); // Refresh balances
  isRefreshing.value = false;
}

function openAddHolding(accountId: number) {
  selectedAccountId.value = accountId;
  showAddHoldingModal.value = true;
}

async function handleHoldingAdded() {
  showAddHoldingModal.value = false;
  if (selectedAccountId.value) {
    await store.fetchInvestmentHoldings(selectedAccountId.value);
    await store.fetchAccounts();
  }
}

function openTransactionModal(holding: InvestmentHolding, type: 'buy' | 'sell') {
  selectedHolding.value = holding;
  transactionType.value = type;
  showTransactionModal.value = true;
}

function openHistoryModal(holding: InvestmentHolding) {
  historyHolding.value = holding;
  historyAccountId.value = null;
  historyIsCash.value = false;
  showHistoryModal.value = true;
}

function openAccountHistory(accountId: number) {
  historyHolding.value = null;
  historyAccountId.value = accountId;
  historyIsCash.value = false;
  showHistoryModal.value = true;
}

function openCashHistory(accountId: number) {
  historyHolding.value = null;
  historyAccountId.value = accountId;
  historyIsCash.value = true;
  showHistoryModal.value = true;
}

function openAdjustCash(accountId: number, currentCash: number) {
  adjustCashAccountId.value = accountId;
  adjustCashCurrentValue.value = currentCash;
  showAdjustCashModal.value = true;
}

async function handleTransactionSaved() {
  showTransactionModal.value = false;
  selectedHolding.value = null;
  transactionType.value = null;
  // Refresh data
  await store.fetchAccounts();
  await store.fetchInvestmentHoldings();
}

function getAccountTypeLabel(typeId: number) {
  return store.accountTypes.find(t => t.id === typeId)?.type || 'Unknown';
}

async function removeHolding(id: number) {
  if (confirm("Are you sure you want to remove this asset?")) {
    await store.removeInvestmentHolding(id);
    await store.fetchAccounts();
  }
}

function getAccountCashBalance(accountId: number) {
  const account = store.accounts.find(a => a.id === accountId);
  if (!account) return 0;
  const accountHoldings = store.investmentHoldings.filter(h => h.accountId === accountId);
  const holdingsValue = accountHoldings.reduce((sum, h) => sum + (h.quantity * (h.lastPrice || 0)), 0);
  return (account.balance || 0) - holdingsValue;
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <header class="flex items-center justify-between mb-6 shrink-0">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          Investments
        </h1>
        <p class="text-gray-500 dark:text-gray-400">
          Manage your portfolios and track holdings.
        </p>
      </div>
      <div class="flex items-center space-x-6">
        <div class="text-right">
          <span
            class="text-2xl font-bold text-gray-900 dark:text-white"
            :class="{ 'privacy-blur': settingsStore.privacyMode }"
          >
            {{ formatCurrency(totalPortfolioValue) }}
          </span>
          <p class="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
            Total Investments Value
          </p>
        </div>
        <button
          class="inline-flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          :disabled="isRefreshing"
          @click="refreshPrices"
        >
          <i :class="['pi pi-refresh mr-2', { 'animate-spin': isRefreshing }]" />
          Refresh Prices
        </button>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto min-h-0 space-y-6 pb-6">
      <div
        v-if="investmentAccounts.length === 0"
        class="flex flex-col items-center justify-center py-12 bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700"
      >
        <i class="pi pi-briefcase text-4xl text-gray-300 dark:text-gray-600 mb-3" />
        <p class="text-gray-500 dark:text-gray-400">
          No investment accounts found.
        </p>
        <p class="text-sm text-gray-400 dark:text-gray-500 mb-4">
          Add an account with an investment classification to get started.
        </p>
      </div>

      <div
        v-for="account in investmentAccounts"
        :key="account.id"
        class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
      >
        <!-- Account Header -->
        <div 
          class="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          @click="toggleAccount(account.id)"
        >
          <div class="flex items-center space-x-4">
            <i 
              class="pi text-gray-400 dark:text-gray-500 transition-transform duration-200"
              :class="expandedAccounts.has(account.id) ? 'pi-chevron-down' : 'pi-chevron-right'"
            />
            <div>
              <div class="flex items-center space-x-2">
                <h3 class="font-bold text-gray-900 dark:text-white">
                  {{ account.accountName }}
                </h3>
                <span class="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full font-medium">
                  {{ getAccountTypeLabel(account.accountTypeId) }}
                </span>
              </div>
              <p
                v-if="account.institutionName"
                class="text-xs text-gray-500 dark:text-gray-400"
              >
                {{ account.institutionName }}
              </p>
            </div>
            <button 
              class="px-4 py-2 bg-primary-50 dark:bg-primary-900/10 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/20 text-xs font-bold rounded-lg transition-colors border border-primary-200 dark:border-primary-800 shrink-0" 
              @click.stop="openAccountHistory(account.id)"
            >
              Total Holdings History
            </button>
          </div>
          <div class="flex items-center space-x-6">
            <div class="text-right">
              <span
                class="text-lg font-bold text-gray-900 dark:text-white"
                :class="{ 'privacy-blur': settingsStore.privacyMode }"
              >
                {{ formatCurrency(account.balance || 0) }}
              </span>
              <p class="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                Total Value
              </p>
            </div>
          </div>
        </div>

        <div v-show="expandedAccounts.has(account.id)">
          <!-- Holdings Table -->
          <div class="overflow-x-auto">
            <table class="w-full text-sm text-left">
              <thead class="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50/30 dark:bg-gray-800/30">
                <tr>
                  <th class="px-4 py-2 font-semibold">
                    Symbol
                  </th>
                  <th class="px-4 py-2 font-semibold">
                    Name
                  </th>
                  <th class="px-4 py-2 font-semibold text-right">
                    Quantity
                  </th>
                  <th class="px-4 py-2 font-semibold text-right">
                    Price
                  </th>
                  <th class="px-4 py-2 font-semibold text-right">
                    Market Value
                  </th>
                  <th class="px-4 py-2 font-semibold text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                <tr
                  v-for="holding in store.investmentHoldings.filter(h => h.accountId === account.id)"
                  :key="holding.id"
                  class="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <td class="px-4 py-3 font-bold text-gray-900 dark:text-white">
                    {{ holding.symbol }}
                  </td>
                  <td class="px-4 py-3 text-gray-500 dark:text-gray-400 truncate max-w-[150px]">
                    {{ holding.name || '---' }}
                  </td>
                  <td class="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                    <span :class="{ 'privacy-blur': settingsStore.privacyMode }">{{ holding.quantity }}</span>
                  </td>
                  <td class="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                    <span :class="{ 'privacy-blur': settingsStore.privacyMode }">{{ formatCurrency(holding.lastPrice || 0) }}</span>
                  </td>
                  <td class="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                    <span :class="{ 'privacy-blur': settingsStore.privacyMode }">{{ formatCurrency(holding.quantity * (holding.lastPrice || 0)) }}</span>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <div class="flex items-center justify-end space-x-2">
                      <button 
                        class="px-2 py-1 text-xs font-semibold bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 rounded transition-colors"
                        title="Buy Asset"
                        @click="openTransactionModal(holding, 'buy')"
                      >
                        Buy
                      </button>
                      <button 
                        class="px-2 py-1 text-xs font-semibold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded transition-colors"
                        title="Sell Asset"
                        @click="openTransactionModal(holding, 'sell')"
                      >
                        Sell
                      </button>
                      <div class="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
                      <button 
                        class="p-1 text-gray-400 hover:text-primary-500 transition-colors" 
                        title="Trade History"
                        @click="openHistoryModal(holding)"
                      >
                        <i class="pi pi-history" />
                      </button>
                      <button 
                        class="p-1 text-gray-400 hover:text-red-500 transition-colors" 
                        title="Remove Holding"
                        @click="removeHolding(holding.id)"
                      >
                        <i class="pi pi-trash" />
                      </button>
                    </div>
                  </td>
                </tr>
                <tr class="bg-gray-50/50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700">
                  <td class="px-4 py-3 font-bold text-gray-900 dark:text-white">
                    {{ getCurrencySymbol() }}
                  </td>
                  <td class="px-4 py-3 text-gray-500 dark:text-gray-400 truncate max-w-[150px]">
                    Uninvested Cash
                  </td>
                  <td class="px-4 py-3 text-right text-gray-400 dark:text-gray-600">
                    ---
                  </td>
                  <td class="px-4 py-3 text-right text-gray-400 dark:text-gray-600">
                    ---
                  </td>
                  <td class="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                    <span :class="{ 'privacy-blur': settingsStore.privacyMode }">{{ formatCurrency(getAccountCashBalance(account.id)) }}</span>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <div class="flex items-center justify-end space-x-2">
                      <button 
                        class="px-2 py-1 text-xs font-semibold invisible"
                        disabled
                      >
                        Buy
                      </button>
                      <button 
                        class="px-2 py-1 text-xs font-semibold invisible"
                        disabled
                      >
                        Sell
                      </button>
                      <div class="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
                      <button 
                        class="p-1 text-gray-400 hover:text-primary-500 transition-colors" 
                        title="Cash History"
                        @click="openCashHistory(account.id)"
                      >
                        <i class="pi pi-history" />
                      </button>
                      <button 
                        class="p-1 text-gray-400 hover:text-primary-500 transition-colors" 
                        title="Adjust Cash Balance"
                        @click="openAdjustCash(account.id, getAccountCashBalance(account.id))"
                      >
                        <i class="pi pi-pencil" />
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="store.investmentHoldings.filter(h => h.accountId === account.id).length === 0">
                  <td
                    colspan="6"
                    class="px-4 py-8 text-center text-gray-400 dark:text-gray-500 italic"
                  >
                    No holdings in this account.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Account Footer/Actions -->
          <div class="p-3 bg-gray-50/30 dark:bg-gray-800/30 flex justify-end">
            <button
              class="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center"
              @click="openAddHolding(account.id)"
            >
              <i class="pi pi-plus-circle mr-1.5" />
              Add Holding
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <AddHoldingModal
      v-if="showAddHoldingModal"
      :account-id="selectedAccountId"
      @close="showAddHoldingModal = false"
      @added="handleHoldingAdded"
    />

    <TransactionHoldingModal
      v-if="showTransactionModal"
      :holding="selectedHolding"
      :type="transactionType"
      @close="showTransactionModal = false"
      @saved="handleTransactionSaved"
    />

    <TradeHistoryModal
      v-if="showHistoryModal"
      :holding="historyHolding"
      :account-id="historyAccountId"
      :is-cash="historyIsCash"
      @close="showHistoryModal = false"
    />

    <AdjustCashModal
      v-if="showAdjustCashModal"
      :account-id="adjustCashAccountId!"
      :current-cash="adjustCashCurrentValue"
      @close="showAdjustCashModal = false"
      @saved="() => { showAdjustCashModal = false; store.fetchAccounts(); }"
    />
  </div>
</template>
