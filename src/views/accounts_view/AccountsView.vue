<template>
  <div class="h-screen flex flex-col">
    <!-- Header -->
    <header class="flex items-center justify-between px-4 h-14 bg-gray-100">
      <div>
        <h2 class="text-xl font-bold text-gray-900">Accounts</h2>
        <p class="text-sm text-gray-500">
          <span>All Accounts</span> ({{ store.accounts.length }})
        </p>
      </div>
      <button
        @click="openDialog = true"
        class="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
      >
        <i class="pi pi-plus mr-2" />
        New Account
      </button>
    </header>

    <div class="mt-4 overflow-auto bg-white rounded-lg shadow">
    <AccountListView
      :accountArray="state.accountArray"
      @edit="editAccount"
      @delete="deleteAccount"
    />
    </div>

    <div v-if="openDialog" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white p-6 rounded-lg w-96 shadow-lg">
        <h2 class="text-xl font-bold mb-4">Add New Account</h2>

        <form @submit.prevent="submitForm" class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">Account Name</label>
            <input
              v-model="form.accountName"
              type="text"
              class="w-full border px-3 py-2 rounded"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-1">Institution</label>
            <input
              v-model="form.institutionName"
              type="text"
              class="w-full border px-3 py-2 rounded"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Starting Balance</label>
            <input
              v-model.number="form.startingBalance"
              type="number"
              min="0"
              step="0.01"
              class="w-full border px-3 py-2 rounded"
              required
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Account Type</label>
            <select
              v-model="form.accountType"
              class="w-full border px-3 py-2 rounded"
              required
            >
              <option value="" disabled>Select an account type</option>
              <option v-for="type in state.accountTypeArray" :key="type.id" :value="type.id">
                {{ type.type }}
              </option>
            </select>
          </div>
          <div class="flex items-center space-x-2">
          <input
            type="checkbox"
            v-model="form.isDefault"
            id="isDefault"
            class="h-4 w-4 text-blue-500 border-gray-300 rounded"
          />
          <label for="isDefault" class="text-sm font-medium">Is Default</label>
        </div>

          <div class="flex justify-end space-x-2 mt-4">
            <button
              type="button"
              @click="closeDialog"
              class="px-4 py-2 border rounded hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useFinanceStore } from '@/stores/finance';
import AccountListView from './components/AccountListView.vue';
import { Account } from '@/types';

const store = useFinanceStore();

const openDialog = ref(false);

let isEdit = false;
let accountEditId = 0;

const state = reactive({
  accountArray: store.accounts,
  accountTypeArray: store.accountTypes
});

const form = reactive({
  accountName: '',
  institutionName: '',
  startingBalance: 0,
  accountType: 0,
  isDefault: false
});


function closeDialog() {
  openDialog.value = false;
  form.accountName = '';
  form.institutionName = '';
  form.startingBalance = 0;
  form.accountType = 0;
  form.isDefault = false;
  isEdit = false;
}

async function submitForm() {

  if(!isEdit){
    store.addAccount({
      id : 0,
      accountName: form.accountName,
      institutionName: form.institutionName,
      startingBalance: form.startingBalance,
      accountTypeId:  form.accountType,
      isDefault: form.isDefault,
    } as Account);
  }
  else{
    store.editAccount({
      id : accountEditId,
      accountName: form.accountName,
      institutionName: form.institutionName,
      startingBalance: form.startingBalance,
      accountTypeId: form.accountType,
      isDefault: form.isDefault} as Account);
  }

  closeDialog();

  await store.fetchAccounts(); 
  state.accountArray = store.accounts; 

  console.log(store.accounts);

}

function editAccount(account: Account) {

  openDialog.value = true;
  form.accountName= account.accountName;
  form.institutionName = account.institutionName ?? "";
  form.startingBalance = account.startingBalance;
  form.accountType = account.accountTypeId;
  form.isDefault = Boolean(account.isDefault);
  isEdit = true;
  accountEditId = account.id;
}

async function deleteAccount(account: Account){ 

  if (store.accounts.length <= 1) {
    alert("You must have at least one account.");
    return;
  }

  if (confirm("Delete this account? This cannot be undone.")) { 
    await store.removeAccount(account.id); 
    await store.fetchAccounts(); 
    state.accountArray = store.accounts; 
    } 
}
</script>
