<script setup lang="ts">
import { computed } from 'vue';
import { Account } from '@/types';
import AccountListTile from './AccountListTile.vue';
import { useFinanceStore } from '@/stores/finance';
import { useSettingsStore } from '@/stores/settings';
import { useFormatter } from '@/composables/useFormatter';

const emit = defineEmits<{
    (e: 'edit', account: Account): void,
    (e: 'delete', account: Account): void,
    (e: 'view-transactions', account: Account): void,
    (e: 'toggle-section', section: string): void
}>();

const props = defineProps<{
    accountArray: Array<Account>,
    highlightedId?: number | null,
    expandedSections: Set<string>
}>();

const store = useFinanceStore();
const settingsStore = useSettingsStore();
const { formatCurrency } = useFormatter();

function toggleSection(section: string) {
  emit('toggle-section', section);
}

const liquidAccounts = computed(() => {
  return props.accountArray.filter(a => {
    const typeObj = store.accountTypes.find(t => t.id === a.accountTypeId);
    return (typeObj?.classification ?? 'liquid') === 'liquid';
  });
});
const liquidTotal = computed(() => liquidAccounts.value.reduce((sum, a) => sum + (a.balance || 0), 0));

const liabilityAccounts = computed(() => {
  return props.accountArray.filter(a => {
    const typeObj = store.accountTypes.find(t => t.id === a.accountTypeId);
    return typeObj?.classification === 'liability';
  });
});
const liabilityTotal = computed(() => liabilityAccounts.value.reduce((sum, a) => sum + (a.balance || 0), 0));

const assetAccounts = computed(() => {
  return props.accountArray.filter(a => {
    const typeObj = store.accountTypes.find(t => t.id === a.accountTypeId);
    return typeObj?.classification === 'asset';
  });
});
const assetTotal = computed(() => assetAccounts.value.reduce((sum, a) => sum + (a.balance || 0), 0));

const investmentAccounts = computed(() => {
  return props.accountArray.filter(a => {
    const typeObj = store.accountTypes.find(t => t.id === a.accountTypeId);
    return typeObj?.classification === 'investment';
  });
});
const investmentTotal = computed(() => investmentAccounts.value.reduce((sum, a) => sum + (a.balance || 0), 0));
</script>

<template>
  <div class="space-y-6">
    <!-- Liquid Accounts -->
    <div
      v-if="liquidAccounts.length > 0"
      class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
    >
      <div 
        class="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        @click="toggleSection('liquid')"
      >
        <div class="flex items-center space-x-3">
          <i 
            class="pi text-gray-400 dark:text-gray-500 transition-transform duration-200"
            :class="expandedSections.has('liquid') ? 'pi-chevron-down' : 'pi-chevron-right'"
          />
          <h3 class="font-bold text-green-600 dark:text-green-400 uppercase tracking-wider text-sm flex items-center">
            Liquid
          </h3>
        </div>
        <div class="text-right">
          <span
            class="text-lg font-bold text-gray-900 dark:text-white"
            :class="{ 'privacy-blur': settingsStore.privacyMode }"
          >
            {{ formatCurrency(liquidTotal) }}
          </span>
        </div>
      </div>

      <div v-show="expandedSections.has('liquid')">
        <!-- Grid Header -->
        <div class="grid grid-cols-[1fr_200px_150px_200px_120px] text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50/30 dark:bg-gray-800/30 px-4 py-3 font-semibold border-b border-gray-100 dark:border-gray-700">
          <div>Account</div>
          <div>Institution</div>
          <div>Type</div>
          <div class="text-right">
            Balance
          </div>
          <div class="text-right pr-2">
            Actions
          </div>
        </div>
        <div class="divide-y divide-gray-200 dark:divide-gray-700">
          <AccountListTile
            v-for="account in liquidAccounts"
            :key="account.id"
            :account-name="account.accountName"
            :starting-balance="account.startingBalance"
            :balance="account.balance"
            :institution-name="account.institutionName ?? ''"
            :account-type-id="account.accountTypeId"
            :is-default="account.isDefault"
            :is-highlighted="account.id === highlightedId"
            @edit="() => emit('edit', account)"
            @delete="() => emit('delete', account)"
            @view-transactions="() => emit('view-transactions', account)"
          />
        </div>
      </div>
    </div>

    <!-- Liability Accounts -->
    <div
      v-if="liabilityAccounts.length > 0"
      class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
    >
      <div 
        class="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        @click="toggleSection('liability')"
      >
        <div class="flex items-center space-x-3">
          <i 
            class="pi text-gray-400 dark:text-gray-500 transition-transform duration-200"
            :class="expandedSections.has('liability') ? 'pi-chevron-down' : 'pi-chevron-right'"
          />
          <h3 class="font-bold text-expense uppercase tracking-wider text-sm flex items-center">
            Liability
          </h3>
        </div>
        <div class="text-right">
          <span
            class="text-lg font-bold text-gray-900 dark:text-white"
            :class="{ 'privacy-blur': settingsStore.privacyMode }"
          >
            {{ formatCurrency(Math.abs(liabilityTotal)) }}
          </span>
        </div>
      </div>

      <div v-show="expandedSections.has('liability')">
        <!-- Grid Header -->
        <div class="grid grid-cols-[1fr_200px_150px_200px_120px] text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50/30 dark:bg-gray-800/30 px-4 py-3 font-semibold border-b border-gray-100 dark:border-gray-700">
          <div>Account</div>
          <div>Institution</div>
          <div>Type</div>
          <div class="text-right">
            Balance
          </div>
          <div class="text-right pr-2">
            Actions
          </div>
        </div>
        <div class="divide-y divide-gray-200 dark:divide-gray-700">
          <AccountListTile
            v-for="account in liabilityAccounts"
            :key="account.id"
            :account-name="account.accountName"
            :starting-balance="account.startingBalance"
            :balance="account.balance"
            :institution-name="account.institutionName ?? ''"
            :account-type-id="account.accountTypeId"
            :is-default="account.isDefault"
            :is-highlighted="account.id === highlightedId"
            @edit="() => emit('edit', account)"
            @delete="() => emit('delete', account)"
            @view-transactions="() => emit('view-transactions', account)"
          />
        </div>
      </div>
    </div>

    <!-- Asset Accounts -->
    <div
      v-if="assetAccounts.length > 0"
      class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
    >
      <div 
        class="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        @click="toggleSection('asset')"
      >
        <div class="flex items-center space-x-3">
          <i 
            class="pi text-gray-400 dark:text-gray-500 transition-transform duration-200"
            :class="expandedSections.has('asset') ? 'pi-chevron-down' : 'pi-chevron-right'"
          />
          <h3 class="font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider text-sm flex items-center">
            Asset
          </h3>
        </div>
        <div class="text-right">
          <span
            class="text-lg font-bold text-gray-900 dark:text-white"
            :class="{ 'privacy-blur': settingsStore.privacyMode }"
          >
            {{ formatCurrency(assetTotal) }}
          </span>
        </div>
      </div>

      <div v-show="expandedSections.has('asset')">
        <!-- Grid Header -->
        <div class="grid grid-cols-[1fr_200px_150px_200px_120px] text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50/30 dark:bg-gray-800/30 px-4 py-3 font-semibold border-b border-gray-100 dark:border-gray-700">
          <div>Account</div>
          <div>Institution</div>
          <div>Type</div>
          <div class="text-right">
            Balance
          </div>
          <div class="text-right pr-2">
            Actions
          </div>
        </div>
        <div class="divide-y divide-gray-200 dark:divide-gray-700">
          <AccountListTile
            v-for="account in assetAccounts"
            :key="account.id"
            :account-name="account.accountName"
            :starting-balance="account.startingBalance"
            :balance="account.balance"
            :institution-name="account.institutionName ?? ''"
            :account-type-id="account.accountTypeId"
            :is-default="account.isDefault"
            :is-highlighted="account.id === highlightedId"
            @edit="() => emit('edit', account)"
            @delete="() => emit('delete', account)"
            @view-transactions="() => emit('view-transactions', account)"
          />
        </div>
      </div>
    </div>

    <!-- Investment Accounts -->
    <div
      v-if="investmentAccounts.length > 0"
      class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
    >
      <div 
        class="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        @click="toggleSection('investment')"
      >
        <div class="flex items-center space-x-3">
          <i 
            class="pi text-gray-400 dark:text-gray-500 transition-transform duration-200"
            :class="expandedSections.has('investment') ? 'pi-chevron-down' : 'pi-chevron-right'"
          />
          <h3 class="font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider text-sm flex items-center">
            Investments
          </h3>
        </div>
        <div class="text-right">
          <span
            class="text-lg font-bold text-gray-900 dark:text-white"
            :class="{ 'privacy-blur': settingsStore.privacyMode }"
          >
            {{ formatCurrency(investmentTotal) }}
          </span>
        </div>
      </div>

      <div v-show="expandedSections.has('investment')">
        <!-- Grid Header -->
        <div class="grid grid-cols-[1fr_200px_150px_200px_120px] text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50/30 dark:bg-gray-800/30 px-4 py-3 font-semibold border-b border-gray-100 dark:border-gray-700">
          <div>Account</div>
          <div>Institution</div>
          <div>Type</div>
          <div class="text-right">
            Balance
          </div>
          <div class="text-right pr-2">
            Actions
          </div>
        </div>
        <div class="divide-y divide-gray-200 dark:divide-gray-700">
          <AccountListTile
            v-for="account in investmentAccounts"
            :key="account.id"
            :account-name="account.accountName"
            :starting-balance="account.startingBalance"
            :balance="account.balance"
            :institution-name="account.institutionName ?? ''"
            :account-type-id="account.accountTypeId"
            :is-default="account.isDefault"
            :is-highlighted="account.id === highlightedId"
            @edit="() => emit('edit', account)"
            @delete="() => emit('delete', account)"
            @view-transactions="() => emit('view-transactions', account)"
          />
        </div>
      </div>
    </div>
  </div>
</template>