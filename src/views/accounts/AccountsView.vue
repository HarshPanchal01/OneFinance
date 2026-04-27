<script setup lang="ts">
import { reactive, ref, onMounted, watch, computed } from 'vue';
import { useFinanceStore } from '@/stores/finance';
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

//Deep copy because the compiler is stupid and can't handle nested reactives
const accounts = store.accounts.filter(() => true);
const accountsTypeArray = store.accountTypes.filter(() => true);
const errorModal = ref<InstanceType<typeof ErrorModal>>();

const openDialog = ref(false);
const showDeleteModal = ref(false);
const accountToDelete = ref<Account | null>(null);
const highlightedId = ref<number | null>(null);

const isEdit = ref(false);
let accountEditId = 0;

const state = reactive({
  accountArray: accounts,
  accountTypeArray: accountsTypeArray
});

function highlightAccount(id?: number | null) {
  if (id) {
    highlightedId.value = id;
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
  isDefault: false
});

const filteredAccountTypes = computed(() => {
  return state.accountTypeArray.filter(t => t.classification === form.classification);
});


function closeDialog() {
  openDialog.value = false;
  isEdit.value = false;
  accountEditId = 0;
  // Reset form object entirely
  Object.assign(form, {
    accountName: '',
    institutionName: '',
    startingBalance: 0 as number | null,
    classification: 'liquid',
    accountType: null,
    isDefault: false
  });
}

async function submitForm() {
  const isLiability = form.classification === 'liability';
  const amount = form.startingBalance ?? 0;
  const processedBalance = isLiability ? -Math.abs(amount) : Math.abs(amount);

  if(!isEdit.value){
    store.addAccount({
      id : 0,
      accountName: form.accountName,
      institutionName: form.institutionName,
      startingBalance: processedBalance,
      accountTypeId:  form.accountType,
      isDefault: form.isDefault,
    } as Account);
  }
  else{
    store.editAccount({
      id : accountEditId,
      accountName: form.accountName,
      institutionName: form.institutionName,
      startingBalance: processedBalance,
      accountTypeId: form.accountType,
      isDefault: form.isDefault
    } as Account);
  }

  closeDialog();

  await store.fetchAccounts(); 
  state.accountArray = store.accounts.filter(() => true);; 

  console.log(store.accounts);

}

function editAccount(account: Account) {
  const accountTypeObj = state.accountTypeArray.find(t => t.id === account.accountTypeId);

  openDialog.value = true;
  form.accountName= account.accountName;
  form.institutionName = account.institutionName ?? "";
  form.startingBalance = Math.abs(account.startingBalance);
  form.classification = accountTypeObj?.classification || 'liquid';
  form.accountType = account.accountTypeId;
  form.isDefault = Boolean(account.isDefault);
  isEdit.value = true;
  accountEditId = account.id;
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
  <div class="h-full flex flex-col">
    <!-- Header -->
    <header class="flex items-center justify-between px-4 h-14 bg-gray-100 dark:bg-gray-900 border-b border-transparent dark:border-gray-800 shrink-0">
      <div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">
          Accounts
        </h2>
      </div>
      <button
        class="inline-flex items-center px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
        @click="openDialog = true"
      >
        <i class="pi pi-plus mr-2" />
        New Account
      </button>
    </header>

    <div class="mt-4 flex-1 min-h-0 overflow-y-auto pr-2 pb-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow">
        <AccountListView
          :account-array="state.accountArray"
          :highlighted-id="highlightedId"
          @edit="editAccount"
          @delete="deleteAccount"
          @view-transactions="viewTransactions"
        />
      </div>

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
                <i class="pi pi-wallet mr-2" />
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
                <i class="pi pi-credit-card mr-2" />
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
                @click="form.classification = 'asset'; form.accountType = null;"
              >
                <i class="pi pi-building mr-2" />
                Asset
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
            <div class="flex items-center space-x-2">
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
                class="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
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
