<script setup lang="ts">
import { computed } from 'vue';
import { Account } from '@/types';
import AccountListTile from './AccountListTile.vue';
import { useFinanceStore } from '@/stores/finance';

const emit = defineEmits<{
    (e: 'edit', account: Account): void,
    (e: 'delete', account: Account): void,
    (e: 'view-transactions', account: Account): void
}>();

const props = defineProps<{
    accountArray: Array<Account>,
    highlightedId?: number | null
}>();

const store = useFinanceStore();

const liquidAccounts = computed(() => {
  return props.accountArray.filter(a => {
    const typeObj = store.accountTypes.find(t => t.id === a.accountTypeId);
    return (typeObj?.classification ?? 'liquid') === 'liquid';
  });
});

const liabilityAccounts = computed(() => {
  return props.accountArray.filter(a => {
    const typeObj = store.accountTypes.find(t => t.id === a.accountTypeId);
    return typeObj?.classification === 'liability';
  });
});

const assetAccounts = computed(() => {
  return props.accountArray.filter(a => {
    const typeObj = store.accountTypes.find(t => t.id === a.accountTypeId);
    return typeObj?.classification === 'asset';
  });
});

const investmentAccounts = computed(() => {
  return props.accountArray.filter(a => {
    const typeObj = store.accountTypes.find(t => t.id === a.accountTypeId);
    return typeObj?.classification === 'investment';
  });
});
</script>

<template>
  <div class="space-y-6">
    <!-- Liquid Accounts -->
    <div v-if="liquidAccounts.length > 0">
      <h3 class="text-sm font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider mb-3 px-1 flex items-center">
        Liquid
      </h3>
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow divide-y divide-gray-200 dark:divide-gray-700 overflow-hidden">
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

    <!-- Liability Accounts -->
    <div v-if="liabilityAccounts.length > 0">
      <h3 class="text-sm font-semibold text-expense uppercase tracking-wider mb-3 px-1 flex items-center">
        Liability
      </h3>
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow divide-y divide-gray-200 dark:divide-gray-700 overflow-hidden">
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

    <!-- Asset Accounts -->
    <div v-if="assetAccounts.length > 0">
      <h3 class="text-sm font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-3 px-1 flex items-center">
        Asset
      </h3>
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow divide-y divide-gray-200 dark:divide-gray-700 overflow-hidden">
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

    <!-- Investment Accounts -->
    <div v-if="investmentAccounts.length > 0">
      <h3 class="text-sm font-semibold text-amber-600 dark:text-amber-500 uppercase tracking-wider mb-3 px-1 flex items-center">
        Investments
      </h3>
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow divide-y divide-gray-200 dark:divide-gray-700 overflow-hidden">
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
</template>